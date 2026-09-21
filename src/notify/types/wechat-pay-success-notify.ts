/** 微信支付成功通知解密后的数据。 */
export interface WechatPaySuccessNotify {
  /** 微信支付商户号。 */
  mchid: string
  /** 发起支付的应用 ID，如小程序 AppID。 */
  appid: string
  /** 商户订单号，对应本地订单的 orderNo。 */
  out_trade_no: string
  /** 微信支付订单号，用于记录支付流水及后续查单、退款。 */
  transaction_id: string
  /** 交易类型，如 JSAPI 表示公众号或小程序支付。 */
  trade_type: string
  /** 交易状态；此类型仅描述支付成功通知，固定为 SUCCESS。 */
  trade_state: 'SUCCESS'
  /** 交易状态的文字描述，如“支付成功”。 */
  trade_state_desc: string
  /** 付款银行类型编码，如 OTHERS。 */
  bank_type: string
  /** 商户下单时传入的附加数据，未设置时可为空。 */
  attach?: string
  /** 带时区的支付成功时间。 */
  success_time: string
  /** 支付者信息。 */
  payer: {
    /** 支付者在当前 AppID 下的微信用户标识。 */
    openid: string
  }
  /** 订单金额及用户实际支付金额信息。 */
  amount: {
    /** 订单总金额，单位：分。 */
    total: number
    /** 用户实际支付金额，单位：分。 */
    payer_total: number
    /** 订单金额币种，如 CNY 表示人民币。 */
    currency: string
    /** 用户实际支付金额的币种，如 CNY 表示人民币。 */
    payer_currency: string
  }
}
