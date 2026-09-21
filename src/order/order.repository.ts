import type { ArrangeInstallationDto } from './dto/arrange-installation.dto';
import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from '../../generated/prisma/client';
import type { PreparedOrder } from './types/prepared-order';
import { PrismaService } from "src/prisma/prisma.service";
import { UserJwtPayload } from "src/common/auth/interfaces/user-jwt-payload.interface";
import { QueryOrderDto } from "./dto/query-order.dto";
import { QueryAllDto } from "./dto/query-all.dto";

@Injectable()
export class OrderRepository {
  // 注入数据库服务。
  constructor(private prisma: PrismaService) { }

  // 后台报完工只进入待确认状态，最终完成时间由客户确认或超时任务填写。
  markPendingConfirmation(id: number, confirmationDeadlineAt: Date, tx: Prisma.TransactionClient) {
    return tx.productOrder.updateMany({
      where: { id, status: 'IN_SERVICE' },
      data: { status: 'PENDING_CONFIRMATION', confirmationDeadlineAt },
    })
  }

  // 归属校验在查询条件中执行，避免暴露其他客户的订单。
  findForCompletion(id: number, userId: number, tx: Prisma.TransactionClient) {
    return tx.productOrder.findFirst({ where: { id, userId }, select: { status: true } })
  }

  // 两种完成路径共用校验条件，退款订单与安装单异常状态不能被完成。
  private completionWhere(): Prisma.ProductOrderWhereInput {
    return {
      status: 'PENDING_CONFIRMATION',
      paymentStatus: 'PAID',
      OR: [{ refundAmount: null }, { refundAmount: 0 }],
      installation: { is: { status: 'COMPLETED', customerConfirmed: false } },
    }
  }

  markCustomerCompleted(id: number, userId: number, completedAt: Date, tx: Prisma.TransactionClient) {
    return tx.productOrder.updateMany({
      where: { ...this.completionWhere(), id, userId },
      data: { status: 'COMPLETED', completedAt, completionType: 'CUSTOMER_CONFIRMED' },
    })
  }

  markCustomerConfirmed(orderId: number, customerConfirmedAt: Date, tx: Prisma.TransactionClient) {
    return tx.installationOrder.update({
      where: { orderId, status: 'COMPLETED', customerConfirmed: false },
      data: { customerConfirmed: true, customerConfirmedAt },
    })
  }

  // 自动完成的扫描和条件更新使用同一组条件，防止扫描后状态或暂停标记发生变化。
  private autoCompletionWhere(now: Date): Prisma.ProductOrderWhereInput {
    return {
      ...this.completionWhere(),
      autoCompletionPaused: false,
      confirmationDeadlineAt: { lte: now },
    }
  }

  findExpiredConfirmations(now: Date, afterId: number, take: number) {
    return this.prisma.productOrder.findMany({
      where: { ...this.autoCompletionWhere(now), id: { gt: afterId } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take,
    })
  }

  markAutoCompleted(id: number, now: Date, tx: Prisma.TransactionClient) {
    return tx.productOrder.updateMany({
      where: { ...this.autoCompletionWhere(now), id },
      data: { status: 'COMPLETED', completedAt: now, completionType: 'AUTO_TIMEOUT' },
    })
  }

  setAutoCompletionPaused(id: number, paused: boolean, tx: Prisma.TransactionClient) {
    return tx.productOrder.updateMany({
      where: { id, status: 'PENDING_CONFIRMATION' },
      data: { autoCompletionPaused: paused },
    })
  }

  // 同步安装单完成状态及时间，保留客户确认字段。
  markInstallationCompleted(orderId: number, completedAt: Date, tx: Prisma.TransactionClient) {
    return tx.installationOrder.update({
      where: { orderId },
      data: { status: 'COMPLETED', completedAt },
    })
  }

  // 查询安装操作所需的订单状态。
  findForInstallation(id: number, tx: Prisma.TransactionClient) {
    return tx.productOrder.findUnique({ where: { id }, select: { status: true } })
  }

  // 按待安装条件更新订单，避免并发或重复安排。
  markInstallationInService(id: number, tx: Prisma.TransactionClient) {
    return tx.productOrder.updateMany({
      where: { id, status: 'PENDING_INSTALLATION' },
      data: { status: 'IN_SERVICE' },
    })
  }

  // 在调用方事务中保存线下安装信息，并同步安装单状态。
  saveInstallationArrangement(orderId: number, dto: ArrangeInstallationDto, tx: Prisma.TransactionClient) {
    return tx.installationOrder.update({
      where: { orderId },
      data: {
        installerName: dto.installerName,
        installerPhone: dto.installerPhone,
        remark: dto.remark ?? null,
        assignedAt: new Date(),
        status: 'IN_SERVICE',
      },
    })
  }

  // 查询取消操作所需的订单、商品明细和安装单，支持事务查询。
  findForCancellation(where: { id: number; userId?: number }, db: Prisma.TransactionClient = this.prisma) {
    return db.productOrder.findFirst({ where, include: { items: true, installation: true } })
  }

  // 按未支付条件更新订单为已取消，返回受影响的记录数。
  markCanceled(where: { id: number; userId?: number }, tx: Prisma.TransactionClient) {
    return tx.productOrder.updateMany({
      where: { ...where, status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', paymentNo: null, paidAt: null },
      data: { status: 'CANCELED', paymentStatus: 'CLOSED', canceledAt: new Date() },
    })
  }

  // 返还商品库存并记录库存流水。
  async restoreStock(productId: number, quantity: number, orderNo: string, operator: string, tx: Prisma.TransactionClient) {
    const product = await tx.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } })
    return tx.stockLog.create({
      data: {
        productId, type: 'CANCEL_RELEASE', change: quantity, stock: product.stock,
        relatedNo: orderNo, reason: '取消待支付订单返还库存', operator,
      }
    })
  }

  // 返还用户积分并记录积分流水。
  async restorePoints(userId: number, points: number, orderNo: string, tx: Prisma.TransactionClient) {
    const account = await tx.user.update({ where: { id: userId }, data: { points: { increment: points } } })
    return tx.pointRecord.create({
      data: {
        userId, type: 'INCOME', businessType: 'PRODUCT_ORDER', relatedNo: orderNo,
        change: points, balance: account.points, description: '取消待支付订单返还积分',
      }
    })
  }

  // 解除订单与未使用优惠券的绑定。
  releaseCoupon(orderId: number, userId: number, tx: Prisma.TransactionClient) {
    return tx.userCoupon.updateMany({
      where: { orderId, userId, status: 'AVAILABLE' }, data: { orderId: null },
    })
  }

  // 在调用方事务中创建订单、扣减库存和积分并占用优惠券。
  async createWithResources(
    prepared: PreparedOrder,
    tx: Prisma.TransactionClient,
  ) {
    const { data, userId, userCouponId, pointsUsed, stockItems } = prepared
    // 1. 使用准备阶段合并并排序的数量扣库存，避免重复处理商品明细。
    for (const { productId, quantity } of stockItems) {
      const changed = await tx.product.updateMany({
        where: { id: productId, isPublished: true, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      })
      if (changed.count !== 1) throw new ConflictException('商品库存不足或已下架，请刷新后重试')
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true } })
      await tx.stockLog.create({
        data: {
          productId, type: 'SALE', change: -quantity, stock: product.stock,
          relatedNo: data.orderNo, reason: '待支付订单占用库存', operator: String(userId),
        },
      })
    }

    // 2. 当前没有冻结字段，先扣可用积分；支付成功时不能再次扣减。
    // 取消订单时需返还积分并记录对应流水；累计使用积分在支付成功时再更新。
    if (pointsUsed > 0) {
      const changed = await tx.user.updateMany({
        where: { id: userId, status: true, points: { gte: pointsUsed } },
        data: { points: { decrement: pointsUsed } },
      })
      if (changed.count !== 1) throw new ConflictException('积分余额不足或账号状态已变化')
      const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } })
      await tx.pointRecord.create({
        data: {
          userId, type: 'EXPENSE', businessType: 'PRODUCT_ORDER', relatedNo: data.orderNo,
          change: -pointsUsed, balance: account.points, description: '待支付订单占用积分',
        },
      })
    }

    // 3. 保存待支付订单及商品快照，返回持久化后的订单和明细。
    const order = await tx.productOrder.create({
      data,
      include: { items: true },
    })

    // 4. orderId非空表示已占用；仍保留AVAILABLE，支付成功后再置USED。
    // 条件更新防止同一张券被并发绑定到多笔订单；失败时前面的写入全部回滚。
    if (userCouponId !== undefined) {
      const changed = await tx.userCoupon.updateMany({
        where: {
          id: userCouponId, userId, status: 'AVAILABLE', orderId: null,
          expiresAt: { gt: new Date() },
        },
        data: { orderId: order.id },
      })
      if (changed.count !== 1) throw new ConflictException('优惠券已被占用或已失效')
    }
    return order
  }


  // 根据微信支付的商户订单号查询订单。
  findOrderByOutTradeNo(orderNo: string) {
    return this.prisma.productOrder.findFirst({
      where: { orderNo }
    })
  }

  // 按用户和状态分页查询订单及总数。
  async orderFindAllByUser(queryOrderDto: QueryOrderDto, user: UserJwtPayload) {
    const pageNum = Number(queryOrderDto.pageNum) || 1
    const pageSize = Number(queryOrderDto.pageSize) || 10
    const userId = user.userId
    const status = queryOrderDto.status
    let where: Prisma.ProductOrderWhereInput = { userId }
    if (status !== 'ALL') where.status = status

    return await Promise.all([
      this.prisma.productOrder.findMany({
        where,
        include: { items: true, installation: true },
        skip: ((pageNum - 1) * pageSize),
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.productOrder.count({ where })
    ])
  }

  // 按订单编号和所属用户查询订单详情。
  findOneByUser(id: number, userId: number) {
    return this.prisma.productOrder.findFirst({
      where: { id, userId },
      include: { items: true, installation: true },
    })
  }

  // 按后台筛选条件分页查询订单及总数。
  async findAll(query: QueryAllDto) {
    const pageNum = Number(query.pageNum) || 1
    const pageSize = Number(query.pageSize) || 10

    const { status, keyWords, createdAtStart, createdAtEnd } = query
    const keyword = keyWords?.trim()
    const where: Prisma.ProductOrderWhereInput = {
      ...(status && status !== 'ALL' ? { status } : {}),

      ...(keyword ? {
        orderNo: { contains: keyword },
      } : {}),

      ...(createdAtStart || createdAtEnd ? {
        createdAt: {
          ...(createdAtStart ? { gte: new Date(createdAtStart) } : {}),
          ...(createdAtEnd ? { lte: new Date(createdAtEnd) } : {}),
        },
      } : {}),
    }

    return await Promise.all([
      this.prisma.productOrder.findMany({
        where,
        include: { items: true, installation: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.productOrder.count({ where })
    ])
  }
}
