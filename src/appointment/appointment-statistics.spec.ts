import { AppointmentRepository } from './appointment.repository'
import { AppointmentService } from './appointment.service'

describe('员工预约全量状态统计', () => {
  it.each([undefined, 'BUDGET'] as const)('统计仅限定员工和类型 %s', async type => {
    const groupBy = jest.fn().mockResolvedValue([])
    await new AppointmentRepository({ appointment: { groupBy } } as any).countAssignedAppointmentsByStatus(21, type)
    expect(groupBy).toHaveBeenCalledWith({ by: ['status'], where: { employeeId: 21, ...(type ? { type } : {}) }, _count: { _all: true } })
  })
  it.each(['PENDING_CONTACT', 'COMPLETED', 'ALL'] as const)('状态筛选%s及分页不影响顶部统计', async status => {
    const repo = {
      findEmployeeByUserId: jest.fn().mockResolvedValue({ id: 21, status: true, user: { role: 'EMPLOYEE', status: true } }),
      getAssignedAppointments: jest.fn().mockResolvedValue([[], 25]),
      countAssignedAppointmentsByStatus: jest.fn().mockResolvedValue([{ status: 'PENDING_CONTACT', _count: { _all: 25 } }, { status: 'COMPLETED', _count: { _all: 8 } }]),
    }
    const result = await new AppointmentService(repo as any).getAssignedAppointments(7, 2, 10, 'BUDGET', status)
    expect(repo.getAssignedAppointments).toHaveBeenCalledWith(21, 2, 10, 'BUDGET', status === 'ALL' ? undefined : status)
    expect(repo.countAssignedAppointmentsByStatus).toHaveBeenCalledWith(21, 'BUDGET')
    expect(result).toMatchObject({ total: 25, pageNum: 2, totalPage: 3, statusCounts: { PENDING_CONTACT: 25, PENDING_VISIT: 0, COMPLETED: 8, CANCELED: 0 } })
  })
})
