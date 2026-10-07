import { ValidationPipe } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { appointmentAlert, projectAlert, installationAlert, feedbackAlert, beijingCalendarDate } from '../common/filters/business-alert'
import { installationScheduledEnd } from '../order/installation-booking'
import { DashboardRepository } from './dashboard.repository'
import { DashboardService } from './dashboard.service'
import { EditAdminProjectDto } from '../renovation-project/dto/admin-project.dto'
import { AppointmentService } from '../appointment/appointment.service'
import { AppointmentRepository } from '../appointment/appointment.repository'
import { OrderRepository } from '../order/order.repository'
import { FeedbackService } from '../feedback/feedback.service'
import { AdminProjectService } from '../renovation-project/admin-project.service'

// 用记录匹配器验证真实查询条件的交集、时间边界及汇总口径，不替代数据库集成测试。
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (value === undefined) return true
    if (key === 'AND') return value.every((part: any) => matches(row, part))
    if (key === 'OR') return value.some((part: any) => matches(row, part))
    const actual = row[key]
    if (value === null || typeof value !== 'object' || value instanceof Date) return actual === value
    if ('is' in value) return actual != null && matches(actual, value.is)
    if (actual == null) return false
    return Object.entries(value).every(([op, operand]: [string, any]) =>
      op === 'in' ? operand.includes(actual) : op === 'lt' ? actual < operand
        : op === 'lte' ? actual <= operand : op === 'gte' ? actual >= operand
          : op === 'contains' ? actual.includes(operand) : false)
  })
}
const now = new Date('2026-10-06T04:00:00Z')
describe('工作台规则与汇总', () => {
  it('预约和反馈严格超过时限才提醒', () => {
    const contact = appointmentAlert('uncontacted', now)
    expect(matches({ status: 'PENDING_CONTACT', createdAt: new Date(now.getTime() - 7200000) }, contact)).toBe(false)
    expect(matches({ status: 'PENDING_CONTACT', createdAt: new Date(now.getTime() - 7200001) }, contact)).toBe(true)
    expect(matches({ status: 'CANCELED', createdAt: new Date(0) }, contact)).toBe(false)
    expect(matches({ status: 'PENDING', createdAt: new Date(now.getTime() - 86400000) }, feedbackAlert(now))).toBe(false)
    expect(matches({ status: 'PENDING', createdAt: new Date(now.getTime() - 86400001) }, feedbackAlert(now))).toBe(true)
    expect(matches({ status: 'PROCESSING', createdAt: new Date(0) }, feedbackAlert(now))).toBe(false)
  })
  it.each(['PENDING_CONTACT', 'PENDING_VISIT', 'COMPLETED', 'CANCELED'])('未分配预约状态 %s', status => {
    expect(matches({ status, employeeId: null }, appointmentAlert('unassigned', now))).toBe(['PENDING_CONTACT', 'PENDING_VISIT'].includes(status))
  })
  it.each(['PENDING_QUOTE', 'PENDING_CONFIRM', 'IN_SERVICE', 'COMPLETED', 'CANCELED'])('项目逾期状态 %s', status => {
    expect(matches({ status, plannedCompletionDate: new Date('2026-10-05') }, projectAlert(now))).toBe(!['COMPLETED', 'CANCELED'].includes(status))
    expect(matches({ status, plannedCompletionDate: new Date('2026-10-06') }, projectAlert(now))).toBe(false)
    expect(matches({ status, plannedCompletionDate: null }, projectAlert(now))).toBe(false)
  })
  it('安装时段结束才逾期，未支付、退款、完工及取消均排除', () => {
    const row = { status: 'IN_SERVICE', paymentStatus: 'PAID', installation: { status: 'IN_SERVICE', scheduledEndAt: new Date(now.getTime() - 1) } }
    expect(matches(row, installationAlert(now))).toBe(true)
    expect(matches({ ...row, installation: { ...row.installation, scheduledEndAt: now } }, installationAlert(now))).toBe(false)
    for (const status of ['COMPLETED', 'CANCELED', 'PENDING_CONFIRMATION']) expect(matches({ ...row, status }, installationAlert(now))).toBe(false)
    for (const paymentStatus of ['UNPAID', 'REFUNDING', 'REFUNDED']) expect(matches({ ...row, paymentStatus }, installationAlert(now))).toBe(false)
    for (const status of ['COMPLETED', 'CANCELED']) expect(matches({ ...row, installation: { ...row.installation, status } }, installationAlert(now))).toBe(false)
    expect(matches({ ...row, installation: null }, installationAlert(now))).toBe(false)
  })
  it.each([
    ['2026-12-31T16:00:00Z', '2027-01-01'],
    ['2026-10-31T15:59:59Z', '2026-10-31'],
    ['2026-10-31T16:00:00Z', '2026-11-01'],
  ])('北京时间日界 %s', (input, expected) => {
    expect(beijingCalendarDate(new Date(input)).toISOString().slice(0, 10)).toBe(expected)
  })
  it('安装结束时间按北京时间计算，允许已过去的有效预约', () => {
    expect(installationScheduledEnd(new Date('2026-10-06'), '09:00-12:00')).toEqual(now)
  })
  it.each([null, '', '上午', '24:00-25:00', '12:00-09:00', '09:00-09:00'])('无效时段不推算 %s', slot => {
    expect(installationScheduledEnd(new Date('2026-10-06'), slot)).toBeNull()
  })
  it('没有安装日期不推算', () => {
    expect(installationScheduledEnd(null, '09:00-12:00')).toBeNull()
  })
  it('累计包含缺失成交时间的历史金额，期间排除缺失时间，未来成交均排除，使用一致性事务', async () => {
    const rows = {
      user: [{ role: 'CUSTOMER', createdAt: now }, { role: 'EMPLOYEE', createdAt: now }],
      appointment: [{ status: 'PENDING_CONTACT', employeeId: null, createdAt: new Date('2026-10-05T23:00:00Z') }],
      renovationProject: [
        { status: 'IN_SERVICE', contractAmount: '0.10', quoteConfirmedAt: now, plannedCompletionDate: new Date('2026-10-05') },
        { status: 'COMPLETED', contractAmount: '100', quoteConfirmedAt: new Date('2026-10-01T00:00:00Z') },
        { status: 'CANCELED', contractAmount: '1000', quoteConfirmedAt: now },
        { status: 'IN_SERVICE', contractAmount: '999', quoteConfirmedAt: null },
        { status: 'COMPLETED', contractAmount: '200', quoteConfirmedAt: new Date('2025-01-01') },
        { status: 'IN_SERVICE', contractAmount: '999', quoteConfirmedAt: new Date('2027-01-01') },
      ],
      productOrder: [
        { status: 'IN_SERVICE', paymentStatus: 'PAID', paidAt: now, paidAmount: '0.20', refundAmount: null },
        { paymentStatus: 'REFUNDING', paidAt: now, paidAmount: '100', refundAmount: '20' },
        { paymentStatus: 'REFUNDED', paidAt: now, paidAmount: '40', refundAmount: '40' },
        { paymentStatus: 'UNPAID', paidAt: now, paidAmount: '999', refundAmount: 0 },
        { paymentStatus: 'PAID', paidAt: new Date('2026-10-01'), paidAmount: '50', refundAmount: '10' },
        { paymentStatus: 'REFUNDING', paidAt: new Date('2025-01-01'), paidAmount: '300.45', refundAmount: '50.10' },
        { paymentStatus: 'REFUNDED', paidAt: new Date('2025-01-01'), paidAmount: '80', refundAmount: '80' },
        { paymentStatus: 'PAID', paidAt: new Date('2027-01-01'), paidAmount: '999', refundAmount: null },
        { paymentStatus: 'PAID', paidAt: null, paidAmount: '999', refundAmount: null },
      ],
      feedback: [{ status: 'PENDING', createdAt: new Date(0) }, { status: 'PROCESSING', createdAt: new Date(0) }],
    }
    const tx: any = {}
    for (const [model, data] of Object.entries(rows)) {
      tx[model] = {
        count: jest.fn(async ({ where } = {} as any) => data.filter(row => matches(row, where)).length),
        aggregate: jest.fn(async ({ where, _sum }) => ({
          _sum: Object.fromEntries(Object.keys(_sum).map(field => [field, data.filter(row => matches(row, where)).reduce((sum, row) => sum.plus(row[field] ?? 0), new Prisma.Decimal(0))])),
        })),
      }
    }
    const db = { $transaction: jest.fn(fn => fn(tx)) }
    const result = await new DashboardRepository(db as never).overview(now)
    expect(result.metrics).toMatchObject({ todayCustomers: 1, todayAppointments: 1, renovationProjects: 6, productOrders: 9, todayRevenue: 80.3, monthRevenue: 220.3, totalRevenue: 2668.65 })
    expect(result.alerts).toEqual({ APPOINTMENT_UNCONTACTED: 1, APPOINTMENT_UNASSIGNED: 1, PROJECT_OVERDUE: 1, INSTALLATION_OVERDUE: 0, FEEDBACK_UNHANDLED: 1 })
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' })
    const repo = { overview: jest.fn().mockResolvedValue(result) }
    const response = await new DashboardService(repo as never).overview()
    expect(response.businessMetrics.map(row => row.key)).toEqual(Object.keys(result.metrics))
    expect(response.businessMetrics).toContainEqual({ key: 'totalRevenue', label: '历史累计成交金额', value: 2668.65, unit: '元' })
    expect(response.alerts.map(row => row.id)).toEqual(['alert-appointment-uncontacted', 'alert-appointment-unassigned', 'alert-project-overdue', 'alert-feedback-unhandled'])
    expect(response.alerts[0].query).toEqual({ alertType: 'uncontacted' })
  })
  it('空数据库返回数值0和空提醒', async () => {
    const model = { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { contractAmount: null, paidAmount: null, refundAmount: null } }) }
    const tx = { user: model, appointment: model, renovationProject: model, productOrder: model, feedback: model }
    const repo = new DashboardRepository({ $transaction: fn => fn(tx) } as never)
    const result = await new DashboardService(repo).overview()
    expect(result.businessMetrics.every(row => row.value === 0)).toBe(true)
    expect(result.businessMetrics).toContainEqual({ key: 'totalRevenue', label: '历史累计成交金额', value: 0, unit: '元' })
    expect(result.businessStatuses.every(row => row.count === 0)).toBe(true)
    expect(result.alerts).toEqual([])
  })
})

describe('列表筛选和项目日期兼容', () => {
  beforeEach(() => { jest.useFakeTimers().setSystemTime(now) })
  afterEach(() => jest.useRealTimers())
  it('预约列表、项目列表和订单列表取筛选交集，列表和total使用同一where', async () => {
    const model = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) }
    await new AppointmentRepository({ appointment: model } as never).GetPlanAll(undefined, 1, 10, 'PLAN', 'uncontacted')
    expect(model.findMany.mock.calls[0][0].where).toEqual({ userId: undefined, type: 'PLAN', AND: [appointmentAlert('uncontacted', now)] })
    expect(model.count.mock.calls[0][0].where).toEqual(model.findMany.mock.calls[0][0].where)
    model.findMany.mockClear(); model.count.mockClear()
    await new OrderRepository({ productOrder: model } as never).findAll({ alertType: 'overdue', status: 'COMPLETED', keyWords: 'ORDER' })
    expect(model.findMany.mock.calls[0][0].where).toMatchObject({ status: 'COMPLETED', orderNo: { contains: 'ORDER' }, AND: [installationAlert(now)] })
    expect(model.count.mock.calls[0][0].where).toEqual(model.findMany.mock.calls[0][0].where)
    model.findMany.mockClear(); model.count.mockClear()
    const db = { renovationProject: model, $transaction: values => Promise.all(values) }
    await new AdminProjectService(db as never).list({ pageNum: 1, pageSize: 10, status: 'COMPLETED', alertType: 'overdue' })
    expect(model.findMany.mock.calls[0][0].where).toMatchObject({ status: 'COMPLETED', AND: [projectAlert(now)] })
    expect(model.count.mock.calls[0][0].where).toEqual(model.findMany.mock.calls[0][0].where)
  })
  it('反馈异常与显式状态取交集', async () => {
    const repo = { findAll: jest.fn().mockResolvedValue([[], 0]) }
    await new FeedbackService(repo as never, {} as never).findAll({ alertType: 'overdue', status: 'PROCESSING' })
    expect(repo.findAll.mock.calls[0][0]).toEqual({ status: 'PROCESSING', AND: [feedbackAlert(now)] })
  })
  it('管理员预约查全量，普通用户只查本人，异常参数不能越权', async () => {
    const repo = { GetPlanAll: jest.fn().mockResolvedValue([[], 0]) }
    const db = { admin: { findUnique: jest.fn().mockResolvedValue({ status: true }) } }
    const service = new AppointmentService(repo as never, db as never)
    await service.GetPlanAll({ pageNum: '1', pageSize: '10' }, { userId: 7, type: 'admin' })
    expect(repo.GetPlanAll).toHaveBeenLastCalledWith(undefined, 1, 10, undefined, undefined)
    await service.GetPlanAll({ pageNum: '1', pageSize: '10' }, { userId: 7, type: 'user' })
    expect(repo.GetPlanAll).toHaveBeenLastCalledWith(7, 1, 10, undefined, undefined)
    await expect(service.GetPlanAll({ pageNum: '1', pageSize: '10', alertType: 'unassigned' }, { userId: 7, type: 'user' })).rejects.toMatchObject({ status: 403 })
    db.admin.findUnique.mockResolvedValue({ status: false })
    await expect(service.GetPlanAll({ pageNum: '1', pageSize: '10' }, { userId: 7, type: 'admin' })).rejects.toMatchObject({ status: 403 })
  })
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  it.each(['2026-10-06', null])('允许项目日期设置或清除 %s', async date => {
    await expect(pipe.transform({ plannedCompletionDate: date }, { type: 'body', metatype: EditAdminProjectDto })).resolves.toMatchObject({ plannedCompletionDate: date })
  })
  it.each(['2026-02-30', '2026-1-1', '2026-10-06T00:00:00Z', '', 1])('拒绝无效项目日期 %s', async date => {
    await expect(pipe.transform({ plannedCompletionDate: date }, { type: 'body', metatype: EditAdminProjectDto })).rejects.toMatchObject({ status: 400 })
  })
})
