import 'reflect-metadata'
import { AppointmentService } from './appointment.service'
import { AppointmentRepository } from './appointment.repository'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'

for (const type of ['PLAN', 'BUDGET', 'CASE']) {
  describe(`${type} 共用取消`, () => {
    const setup = (status: string) => {
      const appointment = { id: 9, type, status, canceledAt: null }
      const repo = {
        findAppointmentForCancel: jest.fn().mockResolvedValue(appointment),
        cancelAppointment: jest.fn().mockResolvedValue({ ...appointment, status: 'CANCELED' }),
      }
      return { repo, service: new AppointmentService(repo as unknown as AppointmentRepository) }
    }
    it.each(['PENDING_CONTACT', 'PENDING_VISIT'])('%s 可以取消', async status => {
      const { service, repo } = setup(status)
      expect((await service.cancelAppointment(9)).status).toBe('CANCELED')
      expect(repo.cancelAppointment).toHaveBeenCalledWith(9, expect.any(Date))
    })
    it('已完成不能取消，已取消直接返回', async () => {
      const completed = setup('COMPLETED')
      await expect(completed.service.cancelAppointment(9)).rejects.toMatchObject({ status: 400 })
      expect(completed.repo.cancelAppointment).not.toHaveBeenCalled()
      const canceled = setup('CANCELED')
      expect((await canceled.service.cancelAppointment(9)).status).toBe('CANCELED')
      expect(canceled.repo.cancelAppointment).not.toHaveBeenCalled()
    })
    it('并发状态改变时返回409', async () => {
      const { service, repo } = setup('PENDING_VISIT')
      repo.cancelAppointment.mockRejectedValue(new PrismaClientKnownRequestError('changed', { code: 'P2025', clientVersion: 'test' }))
      await expect(service.cancelAppointment(9)).rejects.toMatchObject({ status: 409 })
    })
  })
}
it('不存在的预约不能取消', async () => {
  const service = new AppointmentService({ findAppointmentForCancel: async () => null } as unknown as AppointmentRepository)
  await expect(service.cancelAppointment(999)).rejects.toMatchObject({ status: 404 })
})
it('取消写入必须带活动状态条件，防止覆盖已完成状态', async () => {
  const update = jest.fn()
  const repo = new AppointmentRepository({ appointment: { update } } as any)
  await repo.cancelAppointment(9, new Date())
  expect(update.mock.calls[0][0].where).toEqual({ id: 9, status: { in: ['PENDING_CONTACT', 'PENDING_VISIT'] } })
})
