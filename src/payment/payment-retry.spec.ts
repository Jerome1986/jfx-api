import axios from 'axios'
import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common'
import { PaymentService } from './payment.service'
import * as wechatPay from '../utils/wechat-pay'

jest.mock('axios')
jest.mock('../utils/wechat-sign', () => ({
  WechatSign: class {
    signRequest() { return 'test-authorization' }
    signClient(_app: string, timestamp: string, nonceStr: string, prepay: string) {
      return { timeStamp: timestamp, nonceStr, packageValue: 'prepay_id=' + prepay, signType: 'RSA', paySign: 'test-sign' }
    }
  },
}))

describe('WeChat payment retries', () => {
  const service = new PaymentService()
  const pay = () => service.wxPay('商品订单', 'original-order', 'owner-openid', 12345)
  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(wechatPay, 'getPrivateKey').mockReturnValue('test-key')
    ;(axios.isAxiosError as unknown as jest.Mock).mockImplementation(error => error?.isAxiosError === true)
    ;(axios.post as jest.Mock).mockResolvedValue({ data: { prepay_id: 'new-prepay' } })
  })
  afterEach(() => jest.restoreAllMocks())

  it('keeps one-cent testing, original order parameters and a ten-second timeout', async () => {
    await expect(pay()).resolves.toEqual({
      timeStamp: expect.any(String), nonceStr: expect.any(String),
      packageValue: 'prepay_id=new-prepay', signType: 'RSA', paySign: 'test-sign',
    })
    expect(axios.post).toHaveBeenCalledWith(process.env.PAY_URL, expect.objectContaining({
      description: '商品订单', out_trade_no: 'original-order',
      amount: { total: 1, currency: 'CNY' }, payer: { openid: 'owner-openid' },
    }), { headers: { Authorization: 'test-authorization' }, timeout: 10000, proxy: false })
  })
  it.each(['ORDERPAID', 'ORDER_CLOSED', 'ORDERCLOSED', 'OUT_TRADE_NO_USED', 'INVALID_REQUEST'])(
    'maps %s to a conflict without generating another order number', async code => {
      ;(axios.post as jest.Mock).mockRejectedValue({
        isAxiosError: true, response: { status: 400, data: { code } },
      })
      await expect(pay()).rejects.toBeInstanceOf(ConflictException)
      expect(axios.post).toHaveBeenCalledTimes(1)
    },
  )
  it.each([
    { isAxiosError: true, code: 'ECONNABORTED' },
    { isAxiosError: true, code: 'ECONNRESET' },
    { isAxiosError: true, response: { status: 500, data: { code: 'SYSTEM_ERROR' } } },
    { isAxiosError: true, response: { status: 503 } },
    { isAxiosError: true, response: { status: 429 } },
    new Error('upstream failure'),
  ])('maps transport and service failures to 503 (%j)', async error => {
    ;(axios.post as jest.Mock).mockRejectedValue(error)
    await expect(pay()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
  it.each([undefined, '', 123, '   '])('rejects invalid prepay_id (%s)', async prepay_id => {
    ;(axios.post as jest.Mock).mockResolvedValue({ data: { prepay_id } })
    await expect(pay()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
  it('maps signing/key failures to 503 before sending any request', async () => {
    jest.mocked(wechatPay.getPrivateKey).mockImplementation(() => { throw new Error('key unavailable') })
    await expect(pay()).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(axios.post).not.toHaveBeenCalled()
  })
  it('returns a sanitized error for invalid payment information', async () => {
    ;(axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true, response: { status: 400, data: { code: 'PARAM_ERROR', message: 'upstream detail' } },
    })
    await expect(pay()).rejects.toThrow(BadRequestException)
    await expect(pay()).rejects.toThrow('微信支付下单失败，请检查支付信息')
  })
})
