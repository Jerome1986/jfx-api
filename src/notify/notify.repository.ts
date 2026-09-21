import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { WechatPaySuccessNotify } from './types/wechat-pay-success-notify'

@Injectable()
export class NotifyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 支付入账及所有关联业务必须同时提交，失败后允许回调重试。 */
  async proNotify(result: WechatPaySuccessNotify) {
    return this.prisma.$transaction(async tx => {
      const order = await tx.productOrder.findUnique({
        where: { orderNo: result.out_trade_no },
        include: { userCoupon: true },
      })
      if (!order) throw new NotFoundException('支付回调对应的商品订单不存在')
      // TODO：当前仅测试数据，临时跳过金额一致性校验以测试 1 分钱支付；上线前必须恢复。
      // if (!order.payableAmount.mul(100).eq(result.amount.total)) {
      //   throw new BadRequestException('支付金额与订单应付金额不一致')
      // }

      // 已入账的相同流水直接确认，不能覆盖后续安装、完成或退款状态。
      if (order.paymentNo === result.transaction_id && order.paidAt &&
          ['PAID', 'REFUNDING', 'REFUNDED'].includes(order.paymentStatus)) return
      if (order.status !== 'PENDING_PAYMENT' || order.paymentStatus !== 'UNPAID' || order.paymentNo) {
        throw new ConflictException('订单状态或支付流水异常，需核查支付结果')
      }

      const paidAt = new Date(result.success_time)
      // 条件更新是并发入口，只有成功更新的一次才能核销优惠券和累计积分。
      const changed = await tx.productOrder.updateMany({
        where: {
          id: order.id, status: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', paymentNo: null,
        },
        data: {
          status: 'PENDING_INSTALLATION', paymentStatus: 'PAID',
          paymentMethod: 'WECHAT', paymentNo: result.transaction_id, paidAt,
          // 按订单支付总额入账；微信侧优惠不减少本地订单已结清金额。
          paidAmount: new Prisma.Decimal(result.amount.total).div(100),
        },
      })
      if (changed.count !== 1) {
        // ReadCommitted 下重读可看到另一回调刚提交的结果。
        const latest = await tx.productOrder.findUnique({ where: { id: order.id } })
        if (latest?.paymentNo === result.transaction_id && latest.paidAt &&
            ['PAID', 'REFUNDING', 'REFUNDED'].includes(latest.paymentStatus)) return
        throw new ConflictException('订单状态已变化，需核查支付结果')
      }

      // 券在创建订单时已绑定；按该订单的占用关系核销，不重新按当前时间判过期。
      if (order.userCoupon) {
        const coupon = await tx.userCoupon.updateMany({
          where: { id: order.userCoupon.id, orderId: order.id, userId: order.userId, status: 'AVAILABLE' },
          data: { status: 'USED', usedAt: paidAt },
        })
        if (coupon.count !== 1) throw new ConflictException('订单优惠券状态异常')
      } else if (order.couponDiscount.gt(0)) {
        throw new ConflictException('订单优惠券占用记录缺失')
      }

      // 库存和可用积分在下单时已扣减，此处只累计实际使用积分。
      if (order.pointsUsed > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { totalPointsUsed: { increment: order.pointsUsed } },
        })
      }

      // 当前商品均包安装；每个商品订单只对应一张安装服务单。
      await tx.installationOrder.create({
        data: {
          serviceNo: `INSTALL-${order.orderNo}`, orderId: order.id,
          customerName: order.contactName, mobile: order.contactPhone,
          serviceAddress: order.serviceAddress,
          appointmentDate: order.appointmentDate,
          timeSlot: order.timeSlot,
          // Legacy orders without a complete booking still need confirmation.
          status: order.appointmentDate && order.timeSlot ? 'PENDING_ASSIGNMENT' : 'PENDING_APPOINTMENT',
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
  }
}
