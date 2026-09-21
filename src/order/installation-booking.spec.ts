import { ValidationPipe } from '@nestjs/common'
import { CreateOrderDto } from './dto/create-order.dto'
import { parseInstallationBooking } from './installation-booking'
import { OrderPreparationService } from './order-preparation.service'
import { OrderService } from './order.service'
import { Prisma } from '../../generated/prisma/client'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }))
jest.mock('../payment/payment.service', () => ({ PaymentService: class {} }))
jest.mock('../../generated/prisma/client', () => ({ Prisma: {
  Decimal: jest.requireActual('@prisma/client/runtime/client').Decimal,
  TransactionIsolationLevel: { Serializable: 'Serializable' },
} }))

const dto = { contactName: 'Test', contactPhone: '123', serviceAddress: 'Address',
  items: [{ productId: 1, quantity: 1 }], appointmentDate: '2026-09-25', timeSlot: '09:00-12:00' }
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })

describe('Installation booking contract', () => {
  it.each([
    { appointmentDate: undefined }, { timeSlot: undefined }, { appointmentDate: null },
    { appointmentDate: '2026-02-30' }, { appointmentDate: '2026-09-25T00:00:00Z' },
    { appointmentDate: '9月25日' }, { timeSlot: '24:00-25:00' }, { timeSlot: '上午' },
  ])('rejects invalid DTO fields %p', async patch => {
    await expect(pipe.transform({ ...dto, ...patch }, { type: 'body', metatype: CreateOrderDto })).rejects.toThrow()
  })
  it('accepts structured fields without putting them in remarks', async () => {
    await expect(pipe.transform(dto, { type: 'body', metatype: CreateOrderDto })).resolves.toMatchObject(dto)
  })
  it('compares slot start in Beijing time independently of server timezone', () => {
    expect(parseInstallationBooking(dto.appointmentDate, dto.timeSlot, new Date('2026-09-25T00:59:59Z')).appointmentDate.toISOString()).toBe('2026-09-25T00:00:00.000Z')
    expect(() => parseInstallationBooking(dto.appointmentDate, dto.timeSlot, new Date('2026-09-25T01:00:00Z'))).toThrow()
  })
  it.each(['12:00-09:00', '09:00-09:00', '23:00-01:00'])('rejects reversed or empty range %s', slot => {
    expect(() => parseInstallationBooking(dto.appointmentDate, slot, new Date('2026-09-20T00:00:00Z'))).toThrow()
  })
  it('rejects invalid calendar dates and supports leap days', () => {
    expect(() => parseInstallationBooking('2027-02-29', dto.timeSlot, new Date('2026-01-01'))).toThrow()
    expect(parseInstallationBooking('2028-02-29', dto.timeSlot, new Date('2026-01-01')).appointmentDate.toISOString()).toBe('2028-02-29T00:00:00.000Z')
  })
  it('persists the booking in prepared order data before payment', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-20T00:00:00Z'))
    try {
      const tx = { user: { findUnique: jest.fn().mockResolvedValue({ id: 7, status: true, points: 0, openid: 'wx' }) },
        product: { findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Product', price: new Prisma.Decimal(10), isPublished: true, stock: 5, specifications: [] }]) } }
      const prepared = await new OrderPreparationService({} as never).prepare(dto, 7, tx as never)
      expect(prepared.data).toMatchObject({ appointmentDate: new Date('2026-09-25T00:00:00Z'), timeSlot: dto.timeSlot })
      expect(prepared.data.remark).toBeUndefined()
      await expect(new OrderPreparationService({} as never).prepare({ ...dto, appointmentDate: undefined } as never, 7, tx as never)).rejects.toThrow()
    } finally { jest.useRealTimers() }
  })
  it('returns orderId alongside existing payment parameters', async () => {
    const pay = { timeStamp: '1', nonceStr: 'nonce', packageValue: 'prepay_id=test', signType: 'RSA', paySign: 'signature' }
    const service = new OrderService(
      { createWithResources: jest.fn().mockResolvedValue({ id: 15, orderNo: 'order', payableAmount: new Prisma.Decimal(10) }) } as never,
      { prepare: jest.fn().mockResolvedValue({ openid: 'wx' }) } as never,
      { wxPay: jest.fn().mockResolvedValue(pay) } as never,
      { $transaction: jest.fn(callback => callback({})) } as never,
    )
    await expect(service.confrimOrder(dto, { userId: 7 } as never)).resolves.toEqual({ ...pay, orderId: 15 })
  })
})
