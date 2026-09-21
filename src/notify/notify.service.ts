import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common'
import { decryptWechatData } from '../utils/decryptWechatData'
import { NotifyRepository } from './notify.repository'
import type { WechatPaySuccessNotify } from './types/wechat-pay-success-notify'

@Injectable()
export class NotifyService {
  constructor(private readonly notifyRepo: NotifyRepository) { }

  // 微信统一支付回调：验签后的通知解密，再进行业务校验和事务入账。
  async wxNotify(data: any) {
    const key = process.env.API_V3_KEY
    if (!key) throw new InternalServerErrorException('API_V3_KEY 未配置')
    if (!data?.resource) throw new BadRequestException('支付回调缺少 resource')
    const { associated_data, ciphertext, nonce } = data.resource
    const result: WechatPaySuccessNotify = decryptWechatData(key, associated_data, ciphertext, nonce)

    if (!result || result.trade_state !== 'SUCCESS') {
      throw new BadRequestException('不是支付成功通知')
    }
    if (!process.env.MCH_ID || !process.env.APPID) {
      throw new InternalServerErrorException('微信支付商户或应用配置缺失')
    }
    if (result.mchid !== process.env.MCH_ID || result.appid !== process.env.APPID) {
      throw new BadRequestException('支付回调商户或应用不匹配')
    }
    if (typeof result.out_trade_no !== 'string' || !result.out_trade_no.trim() ||
      typeof result.transaction_id !== 'string' || !result.transaction_id.trim()) {
      throw new BadRequestException('支付回调订单号或支付流水号无效')
    }
    if (!Number.isSafeInteger(result.amount?.total) || result.amount.total <= 0 ||
      result.amount.currency !== 'CNY') {
      throw new BadRequestException('支付回调金额或币种无效')
    }
    if (typeof result.success_time !== 'string' || !Number.isFinite(Date.parse(result.success_time))) {
      throw new BadRequestException('支付成功时间无效')
    }

    // 商品支付回调
    await this.notifyRepo.proNotify(result)
    // 只有事务提交成功或确认是重复通知，才确认接收。
    return { code: 'SUCCESS', message: '成功' }
  }

  // 微信统一退款回调
  wxRefund() { }
}
