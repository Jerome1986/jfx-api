import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderRepository } from './order.repository';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface';
import { OrderPreparationService } from './order-preparation.service';
import { PaymentService } from 'src/payment/payment.service';
import { QueryOrderDto } from './dto/query-order.dto';
import { ArrangeInstallationDto } from './dto/arrange-installation.dto';
import { QueryAllDto } from './dto/query-all.dto';


@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name)

  // 后台报完工：安装单完成，订单进入待客户确认状态。
  async completeInstallation(id: number, actor: { userId: number; type: 'user' | 'admin' }) {
    if (actor.type !== 'admin') throw new ForbiddenException('仅后台管理员可确认安装完成')
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      throw new BadRequestException('订单ID必须是有效的正整数')
    }
    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. 查询并校验订单：订单必须存在，且处于服务中状态。
        const order = await this.orderRepo.findForInstallation(id, tx)
        if (!order) throw new NotFoundException('订单不存在')
        if (order.status !== 'IN_SERVICE') throw new ConflictException('仅服务中订单允许确认安装完成')

        // 2. 从安装完工时间起给予客户 7 天确认期，条件更新防止重复报完工重置期限。
        const completedAt = new Date()
        const confirmationDeadlineAt = new Date(completedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
        const changed = await this.orderRepo.markPendingConfirmation(id, confirmationDeadlineAt, tx)
        if (changed.count !== 1) throw new ConflictException('订单状态已变化，请刷新后重试')

        // 3. 记录安装单完工时间，保留 customerConfirmed；订单 completedAt 暂不填写。
        // 任一步骤失败，订单和安装单的更新一起回滚。
        await this.orderRepo.markInstallationCompleted(id, completedAt, tx)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') throw new ConflictException('关联安装单不存在或已变化，请刷新后重试')
        if (error.code === 'P2034') throw new ConflictException('订单数据已变化，请刷新后重试')
      }
      throw error
    }
    return { code: 200, message: '安装已完工，待客户确认', data: null }
  }

  // 客户主动确认：只允许客户端客户确认自己的待确认订单。
  async confirmCompletion(id: number, actor: { userId: number; type: 'user' | 'admin'; role?: string }) {
    if (actor.type !== 'user' || actor.role !== 'CUSTOMER') {
      throw new ForbiddenException('仅客户可确认自己的订单完成')
    }
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      throw new BadRequestException('订单ID必须是有效的正整数')
    }
    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. 按客户归属查询订单，并校验待客户确认状态。
        const order = await this.orderRepo.findForCompletion(id, actor.userId, tx)
        if (!order) throw new NotFoundException('订单不存在')
        if (order.status !== 'PENDING_CONFIRMATION') throw new ConflictException('仅待确认订单允许确认完成')

        // 2. 条件更新订单完成状态和方式，防止与退款或超时任务并发覆盖。
        const completedAt = new Date()
        const changed = await this.orderRepo.markCustomerCompleted(id, actor.userId, completedAt, tx)
        if (changed.count !== 1) throw new ConflictException('订单状态已变化、存在退款或安装单状态异常，无法确认完成')

        // 3. 记录客户确认及确认时间，保留安装完工时间；失败则两张单据一起回滚。
        await this.orderRepo.markCustomerConfirmed(id, completedAt, tx)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && ['P2025', 'P2034'].includes(error.code)) {
        throw new ConflictException('订单或安装单已变化，请刷新后重试')
      }
      throw error
    }
    return { code: 200, message: '订单已确认完成', data: null }
  }

  // 管理员处理线下争议时暂停自动完成；恢复时保留原截止时间。
  async setAutoCompletionPaused(id: number, paused: boolean, actor: { userId: number; type: 'user' | 'admin' }) {
    if (actor.type !== 'admin') throw new ForbiddenException('仅后台管理员可设置自动完成')
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      throw new BadRequestException('订单ID必须是有效的正整数')
    }
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. 校验订单存在且尚在待客户确认阶段。
      const order = await this.orderRepo.findForInstallation(id, tx)
      if (!order) throw new NotFoundException('订单不存在')
      if (order.status !== 'PENDING_CONFIRMATION') throw new ConflictException('仅待确认订单可设置自动完成')

      // 2. 条件更新暂停标记；如果自动完成已先提交，则拒绝修改。
      const changed = await this.orderRepo.setAutoCompletionPaused(id, paused, tx)
      if (changed.count !== 1) throw new ConflictException('订单状态已变化，请刷新后重试')
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
    return { code: 200, message: paused ? '已暂停自动完成' : '已恢复自动完成', data: null }
  }

  // 定时任务入口，按 ID 分页扫描，失败订单留待下一轮重试，不阻塞后续订单。
  async autoCompleteExpiredOrders() {
    const now = new Date()
    const pageSize = 100
    let afterId = 0
    let completed = 0
    while (true) {
      const orders = await this.orderRepo.findExpiredConfirmations(now, afterId, pageSize)
      if (orders.length === 0) break
      for (const order of orders) {
        try {
          completed += await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. 在写入时重新校验待确认、截止时间、暂停、退款及安装单状态。
            // 2. 原子更新最终完成状态、时间和方式；客户确认先完成时 count 为 0。
            const changed = await this.orderRepo.markAutoCompleted(order.id, now, tx)
            // 3. 安装单已完工，保留完工时间及 customerConfirmed=false，不伪造客户确认。
            return changed.count
          }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
        } catch (error) {
          this.logger.error(`订单 ${order.id} 自动完成失败，将在下一轮重试`, error instanceof Error ? error.stack : String(error))
        }
      }
      afterId = orders[orders.length - 1].id
      if (orders.length < pageSize) break
    }
    return completed
  }

  // 安排安装 --- 条件更新防止重复安排，安装信息与两张单据的状态统一提交或回滚。
  async arrangeInstallation(id: number, dto: ArrangeInstallationDto, actor: { userId: number; type: 'user' | 'admin' }) {
    if (actor.type !== 'admin') throw new ForbiddenException('仅后台管理员可安排安装')
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      throw new BadRequestException('订单ID必须是有效的正整数')
    }
    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. 查询订单并校验：订单必须存在，且处于待安装状态。
        const order = await this.orderRepo.findForInstallation(id, tx)
        if (!order) throw new NotFoundException('订单不存在')
        if (order.status !== 'PENDING_INSTALLATION') throw new ConflictException('仅待安装订单允许安排安装')

        // 2. 按待安装条件将订单更新为服务中；更新失败说明状态已变化，终止事务。
        const changed = await this.orderRepo.markInstallationInService(id, tx)
        if (changed.count !== 1) throw new ConflictException('订单状态已变化，请刷新后重试')

        // 3. 保存安装人员、电话、备注及安排时间，并将关联安装单同步更新为服务中。
        // 保留原预约日期和时段；任一步骤失败，订单状态和安装信息一起回滚。
        await this.orderRepo.saveInstallationArrangement(id, dto, tx)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') throw new ConflictException('关联安装单不存在或已变化，请刷新后重试')
        if (error.code === 'P2034') throw new ConflictException('订单数据已变化，请刷新后重试')
      }
      throw error
    }
    return { code: 200, message: '安装安排成功', data: null }
  }


  // 校验订单是否允许取消，兼容重复取消请求。
  private validateCancellation(order: Awaited<ReturnType<OrderRepository['findForCancellation']>>) {
    if (!order) throw new NotFoundException('订单不存在')
    if (order.status === 'CANCELED' && order.paymentStatus === 'CLOSED') return order
    if (order.status !== 'PENDING_PAYMENT' || order.paymentStatus !== 'UNPAID' || order.paymentNo || order.paidAt) {
      throw new ConflictException('只能取消未支付订单，已支付订单请申请退款')
    }
    return order
  }

  // 取消未支付订单，关闭微信支付并在事务中返还占用资源。
  async cancel(id: number, actor: { userId: number; type: 'user' | 'admin' }) {
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      throw new BadRequestException('订单ID必须是有效的正整数')
    }
    const where = { id, ...(actor.type === 'admin' ? {} : { userId: actor.userId }) }
    const order = this.validateCancellation(await this.orderRepo.findForCancellation(where))
    if (order.status === 'CANCELED') return order
    // 先确认微信支付关单成功，再释放资源；失败时允许重试。
    await this.wxPayRepo.closeOrder(order.orderNo)
    try {
      return await this.prisma.$transaction(async tx => {
        // 1. 重新查询并校验订单状态，已取消则直接返回。
        const current = this.validateCancellation(await this.orderRepo.findForCancellation(where, tx))
        if (current.status === 'CANCELED') return current
        // 2. 按未支付条件取消订单；更新失败时核对是否已被其他请求取消。
        const changed = await this.orderRepo.markCanceled(where, tx)
        if (changed.count !== 1) {
          const latest = await this.orderRepo.findForCancellation(where, tx)
          if (latest?.status === 'CANCELED' && latest.paymentStatus === 'CLOSED') return latest
          throw new ConflictException('订单状态已变化，无法取消')
        }
        // 3. 合并同一商品的数量，跳过已删除商品，按商品编号顺序返还库存并记录流水。
        const quantities = new Map<number, number>()
        for (const item of current.items) {
          if (item.productId !== null) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
        }
        for (const [productId, quantity] of [...quantities].sort(([a], [b]) => a - b)) {
          await this.orderRepo.restoreStock(productId, quantity, current.orderNo, actor.type + ':' + actor.userId, tx)
        }
        // 4. 返还订单抵扣的积分并记录流水，未使用积分则跳过。
        if (current.pointsUsed > 0) {
          await this.orderRepo.restorePoints(current.userId, current.pointsUsed, current.orderNo, tx)
        }
        // 5. 解除订单对未使用优惠券的占用。
        await this.orderRepo.releaseCoupon(current.id, current.userId, tx)
        // 6. 查询并返回取消后的订单，以上数据库操作统一提交或回滚。
        return this.orderRepo.findForCancellation(where, tx)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && ['P2034', 'P2025'].includes(error.code)) {
        throw new ConflictException('订单数据已变化，请重试取消')
      }
      throw error
    }
  }

  // 注入订单仓储、下单准备、支付和数据库服务。
  constructor(
    private orderRepo: OrderRepository,
    private readonly orderPreparation: OrderPreparationService,
    private wxPayRepo: PaymentService,
    private prisma: PrismaService
  ) { }
  // 在事务中创建订单并占用资源，提交后发起微信支付。
  async confrimOrder(createOrderDto: CreateOrderDto, user: UserJwtPayload) {
    try {
      const order = await this.prisma.$transaction(async tx => {
        const prepared = await this.orderPreparation.prepare(createOrderDto, user.userId, tx)
        const createdOrder = await this.orderRepo.createWithResources(prepared, tx)
        // openid来自当前登录用户，不写入订单表，仅用于后续支付。
        return { ...createdOrder, openid: prepared.openid }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      // 支付接入位置：事务已提交，使用order.orderNo和order.payableAmount创建支付单。
      const payRes = await this.wxPayRepo.wxPay(
        '商品订单',
        order.orderNo,
        order.openid,
        order.payableAmount.mul(100).toNumber()
      )
      return { ...payRes, orderId: order.id }
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError &&
        ['P2034', 'P2025', 'P2002'].includes(error.code)) {
        throw new ConflictException('订单相关数据已变化，请刷新后重试')
      }
      throw error
    }
  }

  // 查询当前用户的订单列表并返回分页信息。
  async orderFindAllByUser(queryOrderDto: QueryOrderDto, user: UserJwtPayload) {
    const [list, total] = await this.orderRepo.orderFindAllByUser(queryOrderDto, user)

    return {
      list,
      total,
      pageNum: queryOrderDto.pageNum,
      pageSize: queryOrderDto.pageSize,
      totalPage: Math.ceil(total / Number(queryOrderDto.pageSize))
    }
  }

  // 校验订单编号并查询当前用户的订单详情。
  async findOneByUser(id: number, user: UserJwtPayload) {
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      throw new BadRequestException('订单ID必须是有效的正整数')
    }
    const order = await this.orderRepo.findOneByUser(id, user.userId)
    if (!order) throw new NotFoundException('订单不存在')
    return order
  }

  // 查询后台订单列表并返回分页信息。
  async findAll(query: QueryAllDto) {
    const [list, total] = await this.orderRepo.findAll(query)
    return {
      list,
      total,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      totalPage: Math.ceil(total / Number(query.pageNum))
    }
  }
}
