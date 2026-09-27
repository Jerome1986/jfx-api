import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import * as crypto from 'crypto'
import { createWechatPay, getPrivateKey } from 'src/utils/wechat-pay'
import { WechatSign } from 'src/utils/wechat-sign'
import axios from 'axios'

@Injectable()
export class PaymentService {
  constructor() { }
  // 关闭微信支付订单
  async closeOrder(orderNo: string) {
    if (!process.env.MCH_ID || !process.env.SERIALNO) {
      throw new ServiceUnavailableException('微信支付关单配置缺失')
    }
    const path = '/v3/pay/transactions/out-trade-no/' + encodeURIComponent(orderNo) + '/close'
    const body = { mchid: process.env.MCH_ID }
    const signer = new WechatSign({ mchid: body.mchid, serialNo: process.env.SERIALNO, privateKey: getPrivateKey() })
    const authorization = signer.signRequest('POST', path, body,
      Math.floor(Date.now() / 1000).toString(), crypto.randomBytes(16).toString('hex'))
    try {
      const response = await axios.post('https://api.mch.weixin.qq.com' + path, body, {
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        timeout: 10000, proxy: false,
      })
      if (response.status !== 204) throw new Error('Unexpected close response')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.code
        if (code === 'ORDER_CLOSED') return
        if (code === 'ORDERPAID') throw new ConflictException('订单已支付，请刷新订单或申请退款')
      }
      // 订单不存在也不能放行：下单请求可能仍在途中。
      throw new ServiceUnavailableException('微信关单未确认成功，请稍后重试取消')
    }
  }


  // 微信支付
  async wxPay(remark: string, outTradeNo: string, openid: string, amount: number | string) {
    // 构建参数 amount 当前测试用 1分
    const body = {
      appid: process.env.APPID,
      mchid: process.env.MCH_ID,
      description: remark,
      out_trade_no: outTradeNo,
      notify_url: process.env.NOTIFY_URL,
      amount: {
        total: 1, // 单位分
        currency: 'CNY',
      },
      payer: {
        openid,
      },
    }

    try {
      // 调用微信支付签名工具类
      const signer = new WechatSign({
        mchid: process.env.MCH_ID as string,
        serialNo: process.env.SERIALNO as string,
        privateKey: getPrivateKey(),
      })

      // 生成请求签名（用于调用微信接口）
      const nonceStr = crypto.randomBytes(16).toString('hex')
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const authorization = signer.signRequest(
        'POST',
        '/v3/pay/transactions/jsapi',
        body,
        timestamp,
        nonceStr,
      )

      // 调用微信支付接口
      const payRes = await createWechatPay(body, authorization)

      const prepay_id = payRes.data?.prepay_id
      if (typeof prepay_id !== 'string' || !prepay_id.trim()) {
        throw new ServiceUnavailableException('微信下单未返回有效支付参数，请稍后重试')
      }
      // 5. 返回给前端的参数-生成前端支付签名（JSAPI）
      return signer.signClient(process.env.APPID as string, timestamp, nonceStr, prepay_id)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.code
        if (code === 'ORDERPAID') throw new ConflictException('订单已支付，请刷新订单')
        if (code === 'ORDER_CLOSED' || code === 'ORDERCLOSED') {
          throw new ConflictException('微信支付订单已关闭，无法继续支付')
        }
        if (code === 'OUT_TRADE_NO_USED' || code === 'INVALID_REQUEST') {
          throw new ConflictException('微信支付订单状态或下单参数冲突，请刷新订单')
        }
        if (error.response && error.response.status < 500 && error.response.status !== 429) {
          throw new BadRequestException('微信支付下单失败，请检查支付信息')
        }
      }
      throw new ServiceUnavailableException('微信支付暂不可用，请稍后重试')
    }
  }
}
