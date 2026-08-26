// 文件说明：预约业务服务的单元测试。
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/client'

jest.mock('./appointment.repository', () => ({
  AppointmentRepository: class AppointmentRepository {},
}))

import { AppointmentRepository } from './appointment.repository'
import { AppointmentService } from './appointment.service'
import { CreatePlanAppointmentDto } from './dto/create-plan-appointment.dto'

const dto: CreatePlanAppointmentDto = {
  userId: 1,
  planId: 2,
  snapshot: {
    title: '品质厨房焕新',
    cover: 'cover.jpg',
    referencePrice: '4000.00',
    items: [
      {
        sourceItemId: 10,
        candidateId: null,
        productId: 20,
        category: '主材',
        name: '厨房地砖',
        description: '防滑耐磨',
        unit: '㎡',
        unitPrice: '200.00',
        quantity: '20',
        image: 'item.jpg',
      },
    ],
  },
}

describe('AppointmentService', () => {
  let service: AppointmentService
  let repository: jest.Mocked<AppointmentRepository>

  beforeEach(() => {
    repository = {
      findUser: jest.fn(),
      findPublishedPlan: jest.fn(),
      createPlanAppointment: jest.fn(),
      GetPlanAll: jest.fn(),
      getMyAppointments: jest.fn(),
      findAppointmentById: jest.fn(),
      findEmployeeById: jest.fn(),
      createFollowUp: jest.fn(),
      findAppointmentForCancel: jest.fn(),
      cancelPlanAppointment: jest.fn(),
      findBudgetAppointmentByUserId: jest.fn(),
      createBudgetAppointment: jest.fn(),
    } as unknown as jest.Mocked<AppointmentRepository>
    service = new AppointmentService(repository)
  })

  it('用户ID为空时提示先登录', async () => {
    await expect(
      service.createPlanAppointment({ ...dto, userId: null }),
    ).rejects.toThrow(new UnauthorizedException('请先登录后再预约'))
  })

  it('用户不存在或被禁用时拒绝预约', async () => {
    repository.findUser.mockResolvedValueOnce(null)
    await expect(service.createPlanAppointment(dto)).rejects.toThrow(
      UnauthorizedException,
    )

    repository.findUser.mockResolvedValueOnce({
      id: 1,
      mobile: '13800000000',
      status: false,
    })
    await expect(service.createPlanAppointment(dto)).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('直接保存前端提交的预约快照', async () => {
    repository.findUser.mockResolvedValue({
      id: 1,
      mobile: '13800000000',
      status: true,
    })
    repository.findPublishedPlan.mockResolvedValue({
      id: 2,
      summary: '厨房整体焕新方案',
    })
    repository.createPlanAppointment.mockResolvedValue({
      id: 6,
      appointmentNo: 'APT001',
    })

    await expect(service.createPlanAppointment(dto)).resolves.toEqual({
      appointmentId: 6,
      appointmentNo: 'APT001',
    })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.createPlanAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        planId: 2,
        mobile: '13800000000',
        demand: '厨房整体焕新方案',
        snapshot: dto.snapshot,
      }),
    )
  })

  it('未传预约类型时保持查询全部预约', async () => {
    repository.GetPlanAll.mockResolvedValue([[], 0])

    await expect(service.GetPlanAll(1, 10)).resolves.toEqual({
      list: [],
      total: 0,
      pageNum: 1,
      pageSize: 10,
      totalPage: 0,
    })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.GetPlanAll).toHaveBeenCalledWith(1, 10, undefined)
  })

  it('按预约类型查询列表', async () => {
    repository.GetPlanAll.mockResolvedValue([[], 0])

    await service.GetPlanAll(2, 20, 'PLAN')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.GetPlanAll).toHaveBeenCalledWith(2, 20, 'PLAN')
  })

  it('预约类型为ALL时查询全部预约', async () => {
    repository.GetPlanAll.mockResolvedValue([[], 0])

    await service.GetPlanAll(1, 10, 'ALL')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.GetPlanAll).toHaveBeenCalledWith(1, 10, undefined)
  })

  it('查询当前用户预约时固定按用户ID筛选', async () => {
    repository.getMyAppointments.mockResolvedValue([[], 0])

    await expect(
      service.getMyAppointments(8, 2, 10, 'PLAN'),
    ).resolves.toEqual({
      list: [],
      total: 0,
      pageNum: 2,
      pageSize: 10,
      totalPage: 0,
    })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.getMyAppointments).toHaveBeenCalledWith(
      8,
      2,
      10,
      'PLAN',
    )
  })

  it('查询当前用户全部预约时不传预约类型条件', async () => {
    repository.getMyAppointments.mockResolvedValue([[], 0])

    await service.getMyAppointments(8, 1, 10, 'ALL')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.getMyAppointments).toHaveBeenCalledWith(
      8,
      1,
      10,
      undefined,
    )
  })

  it('预约不存在时不能新增跟进', async () => {
    repository.findAppointmentById.mockResolvedValue(null)

    await expect(
      service.createFollowUp(999, {
        content: '已电话联系客户',
        nextFollowAt: null,
      }),
    ).rejects.toThrow(new NotFoundException('预约不存在'))
  })

  it('跟进负责人不存在时不能新增跟进', async () => {
    repository.findAppointmentById.mockResolvedValue({ id: 1 })
    repository.findEmployeeById.mockResolvedValue(null)

    await expect(
      service.createFollowUp(1, {
        content: '已电话联系客户',
        employeeId: 99,
      }),
    ).rejects.toThrow(new NotFoundException('跟进负责人不存在'))
  })

  it('新增预约跟进并转换下次跟进时间', async () => {
    const createdAt = new Date('2026-08-22T02:00:00.000Z')
    const nextFollowAt = new Date('2026-08-25T02:00:00.000Z')
    repository.findAppointmentById.mockResolvedValue({ id: 1 })
    repository.findEmployeeById.mockResolvedValue({ id: 12 })
    repository.createFollowUp.mockResolvedValue({
      id: 3,
      appointmentId: 1,
      projectId: null,
      employeeId: 12,
      content: '已电话联系客户，客户希望周末上门量房',
      nextFollowAt,
      createdAt,
    })

    await expect(
      service.createFollowUp(1, {
        content: '已电话联系客户，客户希望周末上门量房',
        nextFollowAt: '2026-08-25T02:00:00.000Z',
        employeeId: 12,
      }),
    ).resolves.toEqual({
      id: 3,
      appointmentId: 1,
      projectId: null,
      employeeId: 12,
      content: '已电话联系客户，客户希望周末上门量房',
      nextFollowAt,
      createdAt,
    })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.createFollowUp).toHaveBeenCalledWith({
      appointmentId: 1,
      employeeId: 12,
      content: '已电话联系客户，客户希望周末上门量房',
      nextFollowAt,
    })
  })

  it('预约不存在时不能取消', async () => {
    repository.findAppointmentForCancel.mockResolvedValue(null)

    await expect(service.cancelPlanAppointment(999)).rejects.toThrow(
      new NotFoundException('预约不存在'),
    )
  })

  it('非焕新方案预约不能通过该接口取消', async () => {
    repository.findAppointmentForCancel.mockResolvedValue({
      id: 1,
      appointmentNo: 'APT001',
      type: 'CASE',
      status: 'PENDING_CONTACT',
      canceledAt: null,
    })

    await expect(service.cancelPlanAppointment(1)).rejects.toThrow(
      new BadRequestException('该预约不是焕新方案预约'),
    )
  })

  it('已完成的焕新方案预约不能取消', async () => {
    repository.findAppointmentForCancel.mockResolvedValue({
      id: 1,
      appointmentNo: 'APT001',
      type: 'PLAN',
      status: 'COMPLETED',
      canceledAt: null,
    })

    await expect(service.cancelPlanAppointment(1)).rejects.toThrow(
      new BadRequestException('已完成的预约不能取消'),
    )
  })

  it('重复取消时幂等返回已有结果', async () => {
    const canceledAt = new Date('2026-08-22T02:00:00.000Z')
    const appointment = {
      id: 1,
      appointmentNo: 'APT001',
      type: 'PLAN' as const,
      status: 'CANCELED' as const,
      canceledAt,
    }
    repository.findAppointmentForCancel.mockResolvedValue(appointment)

    await expect(service.cancelPlanAppointment(1)).resolves.toEqual(appointment)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.cancelPlanAppointment).not.toHaveBeenCalled()
  })

  it('取消焕新方案预约并记录取消时间', async () => {
    repository.findAppointmentForCancel.mockResolvedValue({
      id: 1,
      appointmentNo: 'APT001',
      type: 'PLAN',
      status: 'PENDING_CONTACT',
      canceledAt: null,
    })
    repository.cancelPlanAppointment.mockImplementation(
      async (id, canceledAt) => ({
        id,
        appointmentNo: 'APT001',
        type: 'PLAN',
        status: 'CANCELED',
        canceledAt,
      }),
    )

    const result = await service.cancelPlanAppointment(1)

    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        appointmentNo: 'APT001',
        type: 'PLAN',
        status: 'CANCELED',
      }),
    )
    expect(result.canceledAt).toBeInstanceOf(Date)
  })

  it('用户已经提交装修报价预约时拒绝重复提交', async () => {
    repository.findBudgetAppointmentByUserId.mockResolvedValue({ id: 8 })

    await expect(
      service.createBudgetAppointment({
        appointmentNo: 'APT001',
        userId: 1,
        type: 'BUDGET',
        source: '装修计算器',
        mobile: '13800000000',
        houseType: '旧房',
        city: '上海',
        area: '89.50',
        roomLayout: '三室两厅',
      }),
    ).rejects.toThrow(new BadRequestException('已经预约过了，请耐心等待'))

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.createBudgetAppointment).not.toHaveBeenCalled()
  })

  it('用户未提交装修报价预约时正常创建', async () => {
    repository.findBudgetAppointmentByUserId.mockResolvedValue(null)
    repository.createBudgetAppointment.mockResolvedValue({
      id: 9,
      appointmentNo: 'APT002',
      userId: 1,
      employeeId: null,
      caseId: null,
      planId: null,
      type: 'BUDGET',
      source: '装修计算器',
      customerName: null,
      mobile: '13800000000',
      houseType: '旧房',
      city: '上海',
      area: new Decimal('89.50'),
      roomLayout: '三室两厅',
      demand: null,
      snapshot: null,
      focus: null,
      visitDate: null,
      timeSlot: null,
      visitAddress: null,
      status: 'PENDING_CONTACT',
      completedAt: null,
      canceledAt: null,
      createdAt: new Date('2026-08-23T00:00:00.000Z'),
      updatedAt: new Date('2026-08-23T00:00:00.000Z'),
    })

    await service.createBudgetAppointment({
      appointmentNo: 'APT002',
      userId: 1,
      type: 'BUDGET',
      source: '装修计算器',
      mobile: '13800000000',
      houseType: '旧房',
      city: '上海',
      area: '89.50',
      roomLayout: '三室两厅',
    })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.findBudgetAppointmentByUserId).toHaveBeenCalledWith(1)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.createBudgetAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        area: expect.any(Decimal),
      }),
    )
  })
})
