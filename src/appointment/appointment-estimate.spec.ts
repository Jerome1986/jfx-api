import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { CompleteAppointmentDto } from './dto/complete-appointment.dto'
import { AppointmentService } from './appointment.service'
import { AppointmentRepository } from './appointment.repository'
import { toAppointmentResponse } from './appointment-response'
import { EmployeeService } from '../employee/employee.service'

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
})
const validate = (body: unknown): Promise<CompleteAppointmentDto> =>
  pipe.transform(body, {
    type: 'body',
    metatype: CompleteAppointmentDto,
  })

describe('预约预估报价', () => {
  it.each(['0', '-1', '1.001', '100000000', '1e3', '', 68000])(
    '拒绝非法金额 %s',
    async (amount) => {
      await expect(validate({ estimatedAmount: amount })).rejects.toThrow()
    },
  )

  it.each(['0.01', '68000.00', '99999999.99'])(
    '接受合法金额 %s',
    async (amount) => {
      expect(
        (await validate({ estimatedAmount: amount })).estimatedAmount,
      ).toBe(amount)
    },
  )

  it('允许无请求体、空说明，并校验说明长度和未知字段', async () => {
    await expect(validate(undefined)).resolves.toBeDefined()
    expect(
      (await validate({ estimateDescription: '  说明  ' })).estimateDescription,
    ).toBe('说明')
    await expect(validate({ estimateDescription: null })).resolves.toBeDefined()
    await expect(
      validate({ estimateDescription: '字'.repeat(192) }),
    ).rejects.toThrow()
    await expect(validate({ type: 'PLAN' })).rejects.toThrow()
  })

  const actor = { userId: 1, role: 'EMPLOYEE', type: 'user' } as const
  let repo: Record<string, jest.Mock>
  let service: AppointmentService
  beforeEach(() => {
    repo = {
      findEmployeeByUserId: jest.fn().mockResolvedValue({
        id: 12,
        status: true,
        user: { status: true, role: 'EMPLOYEE' },
      }),
      findOneForEmployee: jest
        .fn()
        .mockResolvedValue({ type: 'BUDGET', status: 'PENDING_VISIT' }),
      appointmentCompleted: jest.fn().mockResolvedValue({
        estimatedAmount: new Prisma.Decimal('68000'),
        estimateDescription: null,
        estimatedAt: new Date(),
      }),
    }
    service = new AppointmentService(repo as unknown as AppointmentRepository)
  })

  it.each(['BUDGET', 'QUOTE'])('%s 缺少金额不写入', async (type) => {
    repo.findOneForEmployee.mockResolvedValue({ type, status: 'PENDING_VISIT' })
    await expect(service.completeAppointment(1, actor, {})).rejects.toThrow(
      '必须填写预估金额',
    )
    expect(repo.appointmentCompleted).not.toHaveBeenCalled()
  })

  it('报价预约传入 Decimal，空说明保存为 null', async () => {
    const result = await service.completeAppointment(1, actor, {
      estimatedAmount: '68000.00',
      estimateDescription: ' ',
    })
    expect(repo.appointmentCompleted).toHaveBeenCalledWith(1, 12, 'BUDGET', {
      estimatedAmount: new Prisma.Decimal('68000'),
      estimateDescription: null,
    })
    expect(result.estimatedAmount).toBe('68000.00')
  })

  it.each(['PLAN', 'MEASURE', 'CASE', 'OUTLET'])(
    '%s 保留无请求体完成行为',
    async (type) => {
      repo.findOneForEmployee.mockResolvedValue({
        type,
        status: 'PENDING_VISIT',
      })
      await service.completeAppointment(1, actor)
      expect(repo.appointmentCompleted).toHaveBeenCalledWith(
        1,
        12,
        type,
        undefined,
      )
    },
  )

  it('拒绝非负责人和非待上门预约', async () => {
    repo.findOneForEmployee.mockResolvedValue(null)
    await expect(service.completeAppointment(1, actor)).rejects.toThrow(
      '预约不存在或无权访问',
    )
    repo.findOneForEmployee.mockResolvedValue({ status: 'COMPLETED' })
    await expect(service.completeAppointment(1, actor)).rejects.toThrow(
      '当前预约状态',
    )
    expect(repo.appointmentCompleted).not.toHaveBeenCalled()
  })

  it('拒绝停用员工', async () => {
    repo.findEmployeeByUserId.mockResolvedValue({ status: false })
    await expect(service.completeAppointment(1, actor)).rejects.toThrow(
      '当前员工账号不可用',
    )
    expect(repo.appointmentCompleted).not.toHaveBeenCalled()
  })

  it('并发状态变更转换为冲突错误', async () => {
    repo.appointmentCompleted.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('changed', {
        code: 'P2025',
        clientVersion: '7.9.1',
      }),
    )
    await expect(
      service.completeAppointment(1, actor, { estimatedAmount: '1' }),
    ).rejects.toThrow('预约状态或负责人已变更')
  })

  it('单次条件更新同时写入预估报价和完成时间', async () => {
    const update = jest
      .fn<Promise<object>, [Prisma.AppointmentUpdateArgs]>()
      .mockResolvedValue({})
    const repository = new AppointmentRepository({
      appointment: { update },
    } as never)
    await repository.appointmentCompleted(1, 12, 'BUDGET', {
      estimatedAmount: new Prisma.Decimal('1'),
      estimateDescription: null,
    })
    const args = update.mock.calls[0][0]
    expect(args.where).toEqual({
      id: 1,
      employeeId: 12,
      type: 'BUDGET',
      status: 'PENDING_VISIT',
    })
    expect(args.data.status).toBe('COMPLETED')
    expect(args.data.estimatedAt).toBe(args.data.completedAt)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('响应映射保留其他字段且统一空值', () => {
    expect(
      toAppointmentResponse({
        id: 1,
        estimatedAmount: null,
        estimateDescription: null,
        estimatedAt: null,
      }),
    ).toEqual({
      id: 1,
      estimatedAmount: null,
      estimateDescription: null,
      estimatedAt: null,
    })
  })

  it('项目实际金额由明细计算，不复制预估金额', async () => {
    const appointmentRepo = {
      findAppointmentForProject: jest.fn().mockResolvedValue({
        employeeId: 12,
        userId: 5,
        status: 'COMPLETED',
        type: 'BUDGET',
        estimatedAmount: new Prisma.Decimal('68000'),
      }),
    }
    const projectRepo = {
      getProjectByAppointmentId: jest.fn().mockResolvedValue(null),
      createRenovationProject: jest.fn<
        unknown,
        [Prisma.RenovationProjectUncheckedCreateInput]
      >(),
    }
    const employeeRepo = { findByUserId: repo.findEmployeeByUserId }
    const employeeService = new EmployeeService(
      employeeRepo as never,
      {} as never,
      projectRepo as never,
      appointmentRepo as never,
      { renewalPlan: { findFirst: jest.fn().mockResolvedValue({ id: 3 }) } } as never,
    )
    const dto = {
      appointmentId: 1,
      name: '厨房',
      customerName: '张先生',
      mobile: '13800000000',
      serviceAddress: '武汉',
      planId: 3,
      quoteItems: [
        {
          name: '水龙头',
          category: '主材',
          unit: '个',
          unitPrice: '423.00',
          quantity: '2',
        },
      ],
    }
    await employeeService.CreateProject(dto, actor)
    const data = projectRepo.createRenovationProject.mock.calls[0][0]
    expect(data.quotedAmount).toEqual(new Prisma.Decimal('846'))
    expect(data.userId).toBe(5)
    for (const source of [
      { status: 'PENDING_VISIT', estimatedAmount: new Prisma.Decimal('1') },
      { status: 'COMPLETED', estimatedAmount: null },
    ]) {
      appointmentRepo.findAppointmentForProject.mockResolvedValue({
        employeeId: 12,
        userId: 5,
        type: 'BUDGET',
        ...source,
      })
      await expect(employeeService.CreateProject(dto, actor)).rejects.toThrow()
    }
    expect(projectRepo.createRenovationProject).toHaveBeenCalledTimes(1)
    projectRepo.getProjectByAppointmentId.mockResolvedValue({ id: 99 })
    await expect(employeeService.CreateProject(dto, actor)).resolves.toEqual({
      id: 99,
    })
  })

  it('已结束的预算预约不阻止再次提交，查询仅包含进行中状态', async () => {
    const findFirst = jest
      .fn<Promise<null>, [Prisma.AppointmentFindFirstArgs]>()
      .mockResolvedValue(null)
    const repository = new AppointmentRepository({
      appointment: { findFirst },
    } as never)
    await repository.findBudgetAppointmentByUserId(5)
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      status: { in: ['PENDING_CONTACT', 'PENDING_VISIT'] },
    })
  })
})
