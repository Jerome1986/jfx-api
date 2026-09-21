import * as crypto from 'crypto'

// 签名需要的参数
interface SignOptions {
  mchid: string
  serialNo: string
  privateKey: string
}

/**
 * 微信支付签名工具类
 */
export class WechatSign {
  private mchid: string
  private serialNo: string
  private privateKey: string

  constructor(options: SignOptions) {
    this.mchid = options.mchid
    this.serialNo = options.serialNo
    this.privateKey = options.privateKey
  }

  /**
   * 生成请求签名（用于调用微信接口）
   */
  signRequest(method: string, url: string, body: any, timestamp: string, nonceStr: string) {
    const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body ? JSON.stringify(body) : ''}\n`

    const signature = this.sign(message)

    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${this.serialNo}",signature="${signature}"`
  }

  /**
   * 生成前端支付签名（JSAPI）
   */
  signClient(appid: string, timestamp: string, nonceStr: string, prepayId: string) {
    const packageValue = `prepay_id=${prepayId}`
    const payMessage = `${appid}\n${timestamp}\n${nonceStr}\n${packageValue}\n`
    const paySign = this.sign(payMessage)

    return {
      timeStamp: timestamp,
      nonceStr,
      packageValue,
      signType: 'RSA',
      paySign,
    }
  }

  /**
   * 支付签名方法
   */
  private sign(message: string) {
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(message)
    signer.end()

    return signer.sign(
      {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      'base64',
    )
  }

  // NATIVE下单签名
  nativeSign(method: string, url: string, body: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = crypto.randomBytes(16).toString('hex')

    const message =
      `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`

    const signature = crypto
      .createSign('RSA-SHA256')
      .update(message)
      .sign(this.privateKey, 'base64')

    return {
      timestamp,
      nonceStr,
      signature
    }
  }
}
