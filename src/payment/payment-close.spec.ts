import axios from 'axios'
import { PaymentService } from './payment.service'
import { ConflictException, ServiceUnavailableException } from '@nestjs/common'
jest.mock('axios')
jest.mock('../utils/wechat-pay', () => ({ getPrivateKey: () => 'test-key' }))
jest.mock('../utils/wechat-sign', () => ({ WechatSign: class { signRequest() { return 'test-signature' } } }))
describe('close WeChat order', () => {
  const oldMch = process.env.MCH_ID, oldSerial = process.env.SERIALNO
  beforeEach(() => {
    jest.resetAllMocks()
    process.env.MCH_ID = 'test-merchant'
    process.env.SERIALNO = 'test-serial'
    ;(axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true)
  })
  afterAll(() => {
    if (oldMch === undefined) delete process.env.MCH_ID; else process.env.MCH_ID = oldMch
    if (oldSerial === undefined) delete process.env.SERIALNO; else process.env.SERIALNO = oldSerial
  })
  it('accepts a confirmed close', async () => {
    ;(axios.post as jest.Mock).mockResolvedValue({ status: 204 })
    await expect(new PaymentService().closeOrder('order1')).resolves.toBeUndefined()
    expect(axios.post).toHaveBeenCalledWith('https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/order1/close',
      { mchid: 'test-merchant' }, expect.objectContaining({ timeout: 10000 }))
  })
  it('accepts already closed for retry recovery', async () => {
    ;(axios.post as jest.Mock).mockRejectedValue({ response: { data: { code: 'ORDER_CLOSED' } } })
    await expect(new PaymentService().closeOrder('order1')).resolves.toBeUndefined()
  })
  it('rejects paid orders', async () => {
    ;(axios.post as jest.Mock).mockRejectedValue({ response: { data: { code: 'ORDERPAID' } } })
    await expect(new PaymentService().closeOrder('order1')).rejects.toThrow(ConflictException)
  })
  it.each(['ORDER_NOT_EXIST', 'SYSTEM_ERROR', undefined])('does not treat %s as confirmed closure', async code => {
    ;(axios.post as jest.Mock).mockRejectedValue({ response: { data: { code } } })
    await expect(new PaymentService().closeOrder('order1')).rejects.toThrow(ServiceUnavailableException)
  })
})
