import { ForbiddenException } from '@nestjs/common'
import { AppointmentService } from './appointment.service'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'

describe('员工负责预约查询权限', () => {
  const user: UserJwtPayload = { userId: 7, type: 'user', role: 'EMPLOYEE' }

  it.each([
    [{ ...user, role: 'CUSTOMER' }, 7],
    [{ ...user, type: 'admin' }, 7],
    [user, 8],
  ])('拒绝无权查询的身份 %j 和用户 ID %s', async (payload, userId) => {
    const repo = { findEmployeeByUserId: jest.fn() }
    const service = new AppointmentService(repo as any, {} as never)

    await expect(service.getAssignedAppointments(payload as UserJwtPayload, userId, 1, 10))
      .rejects.toThrow(ForbiddenException)
    expect(repo.findEmployeeByUserId).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { status: false, user: { status: true, role: 'EMPLOYEE' } },
    { status: true, user: { status: false, role: 'EMPLOYEE' } },
    { status: true, user: { status: true, role: 'CUSTOMER' } },
  ])('拒绝不可用的员工账号 %j', async employee => {
    const repo = {
      findEmployeeByUserId: jest.fn().mockResolvedValue(employee),
      getAssignedAppointments: jest.fn(),
      countAssignedAppointmentsByStatus: jest.fn(),
    }
    const service = new AppointmentService(repo as any, {} as never)

    await expect(service.getAssignedAppointments(user, 7, 1, 10))
      .rejects.toThrow(ForbiddenException)
    expect(repo.getAssignedAppointments).not.toHaveBeenCalled()
    expect(repo.countAssignedAppointmentsByStatus).not.toHaveBeenCalled()
  })
})
