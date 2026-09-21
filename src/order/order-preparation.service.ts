import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { calculateProductAmount } from '../utils/order-amount.util';
import { generateRandomCode } from 'src/utils/random.util';
import { UserCouponRepository } from 'src/user-coupon/user-coupon.repository';
import { parseInstallationBooking } from './installation-booking';
import type { PreparedOrder } from './types/prepared-order';

/** 负责订单校验、价格快照和优惠计算；数据库读取使用调用方的事务。 */
@Injectable()
export class OrderPreparationService {
  constructor(private readonly userCouponRepo: UserCouponRepository) {}

  /** 使用事务客户端读取数据，准备价格快照及优惠金额。 */
  async prepare(
    createOrderDto: CreateOrderDto,
    userId: number,
    tx: Prisma.TransactionClient,
  ): Promise<PreparedOrder> {
    // 1. 拆分下单选项；用户身份取自已验证的登录信息，积分默认不使用。
    const { userCouponId, pointsUsed = 0, items, appointmentDate, timeSlot, ...contactInfo } = createOrderDto
    const booking = parseInstallationBooking(appointmentDate, timeSlot)
    // 2. 读取账号最新状态和积分余额，避免使用登录时的过期信息。
    const account = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, points: true, openid: true },
    })
    if (!account) throw new NotFoundException('用户不存在')
    if (!account.status) throw new ForbiddenException('用户已被禁用')
    if (!account.openid?.trim()) throw new BadRequestException('用户未绑定微信，无法发起微信支付')

    // 3. 去重后批量查询商品，使用数据库售价计算总额，不接受前端报价。
    if (!items.length) throw new BadRequestException('至少选择一件商品')
    const products = await tx.product.findMany({
      where: { id: { in: [...new Set(items.map(item => item.productId))] } },
      select: {
        id: true, name: true, price: true, mainImage: true,
        isPublished: true, stock: true, specifications: true,
      },
    })
    const productAmount = calculateProductAmount(items, products)
    // 4. 校验商品可售、库存及规格，并保存下单时的商品和价格快照。
    const productMap = new Map(products.map(product => [product.id, product]))
    const quantities = new Map<number, number>()
    const orderItems = items.map(item => {
      const product = productMap.get(item.productId)!
      if (!product.isPublished) throw new BadRequestException(`商品${product.name}已下架`)
      // 同一商品可能分成多行（不同规格），库存需按所有行的总数量检查。
      const quantity = (quantities.get(item.productId) ?? 0) + item.quantity
      quantities.set(item.productId, quantity)
      if (quantity > product.stock) throw new BadRequestException(`商品${product.name}库存不足`)
      const specifications = Array.isArray(product.specifications) ? product.specifications : []
      if (specifications.length && !item.skuDescription) {
        throw new BadRequestException(`请选择商品${product.name}的规格`)
      }
      if (item.skuDescription && !specifications.includes(item.skuDescription)) {
        throw new BadRequestException(`商品${product.name}的规格无效`)
      }
      // 商品名称、图片和价格后续可能修改，订单明细保存本次查询到的值。
      return {
        product: { connect: { id: product.id } },
        productName: product.name,
        skuDescription: item.skuDescription,
        image: product.mainImage,
        unitPrice: product.price,
        quantity: item.quantity,
        subtotal: new Prisma.Decimal(product.price).mul(item.quantity),
        // 当前商品均包安装，不另收安装费用。
        requiresInstall: true,
        installationFee: new Prisma.Decimal(0),
      }
    })
    // 5. 生成订单编号。
    const orderNo = generateRandomCode(24)
    // 6. 校验优惠券并计算实际抵扣金额，未选券时返回0。
    const couponDiscount = await this.calculateCouponDiscount({
      userCouponId,
      userId: account.id,
      productAmount,
    }, tx)
    // 7. 校验积分余额，按1积分抵1元计算，抵扣上限为券后剩余金额。
    const pointDiscount = this.calculatePointDiscount({
      pointsUsed,
      availablePoints: account.points,
      remainingAmount: productAmount.minus(couponDiscount),
    })
    // 8. 应付金额 = 商品总额 - 优惠券抵扣 - 积分抵扣，全程使用Decimal。
    const payableAmount = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      productAmount.minus(couponDiscount).minus(pointDiscount),
    )
    // 9. 组装创建参数；优惠券由仓储条件更新锁定，不能直接connect覆盖已有占用。
    const orderData: Prisma.ProductOrderCreateInput = {
      ...contactInfo,
      ...booking,
      orderNo,
      user: { connect: { id: account.id } },
      productAmount,
      couponDiscount,
      pointDiscount,
      pointsUsed,
      installationFee: new Prisma.Decimal(0),
      payableAmount,
      // 尚未支付，实付金额为0；应在验证支付结果后更新。
      paidAmount: new Prisma.Decimal(0),
      items: { create: orderItems },
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
    }
    // 10. 将参数交给仓储，在当前事务中保存并占用库存、优惠券及积分。
    return {
      data: orderData,
      userId: account.id,
      openid: account.openid,
      userCouponId,
      pointsUsed,
      stockItems: [...quantities]
        .sort(([a], [b]) => a - b)
        .map(([productId, quantity]) => ({ productId, quantity })),
    }
  }

  /** 校验用户券归属、状态、有效期及适用规则，返回实际抵扣金额。 */
  private async calculateCouponDiscount({
    userCouponId,
    userId,
    productAmount,
  }: {
    userCouponId?: number
    userId: number
    productAmount: Prisma.Decimal
  }, tx: Prisma.TransactionClient): Promise<Prisma.Decimal> {
    if (userCouponId === undefined) return new Prisma.Decimal(0)

    // 1. 确认券属于当前用户，且尚未使用或关联其他订单。
    const userCoupon = await this.userCouponRepo.findOne(userCouponId, tx)
    if (!userCoupon) throw new NotFoundException('用户优惠券不存在')
    if (userCoupon.userId !== userId) throw new ForbiddenException('不能使用其他用户的优惠券')
    if (userCoupon.status !== 'AVAILABLE' || userCoupon.orderId !== null) {
      throw new BadRequestException('优惠券已使用或不可用')
    }

    // 2. 过期时间采用发券时保存的expiresAt，避免模板延期自动延长已发券。
    const now = new Date()
    if (userCoupon.expiresAt <= now) throw new BadRequestException('优惠券已过期')
    const coupon = userCoupon.coupon
    if (coupon.validFrom > now) throw new BadRequestException('优惠券尚未生效')

    // 3. 检查模板范围及门槛；停用只停止发放，已领取的券仍可按规则使用。
    if (coupon.status === 'DRAFT') throw new BadRequestException('优惠券模板尚未发布')
    if (coupon.scopeType !== 'ALL' && coupon.scopeType !== 'PRODUCT') {
      throw new BadRequestException('该优惠券不适用于商品订单')
    }
    if (productAmount.lt(coupon.threshold)) throw new BadRequestException('订单金额未达到优惠券使用门槛')

    // 4. 实际抵扣不超过商品总额。
    return Prisma.Decimal.min(coupon.amount, productAmount)
  }

  /** 按1积分抵1元计算，校验积分余额和券后抵扣上限。 */
  private calculatePointDiscount({
    pointsUsed,
    availablePoints,
    remainingAmount,
  }: {
    pointsUsed: number
    availablePoints: number
    remainingAmount: Prisma.Decimal
  }): Prisma.Decimal {
    if (!Number.isInteger(pointsUsed) || pointsUsed < 0 || pointsUsed > availablePoints) {
      throw new BadRequestException('使用积分数量不合法或积分余额不足')
    }
    const pointDiscount = new Prisma.Decimal(pointsUsed)
    if (pointDiscount.gt(remainingAmount)) {
      throw new BadRequestException('积分抵扣金额不能超过优惠券抵扣后的应付金额')
    }
    return pointDiscount
  }
}
