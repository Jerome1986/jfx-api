import 'reflect-metadata'
import {
  BadRequestException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { AdminProjectService } from './admin-project.service'
import { toAdminProject } from './admin-project-response'
import {
  AddProjectFollowUpDto,
  AddProjectProgressDto,
  CreateAdminProjectDto,
  EditAdminProjectDto,
  QueryAdminProjectDto,
  SaveAdminQuotationDto,
} from './dto/admin-project.dto'
import { projectQuoteTotal } from './project-amount'

const now = new Date('2026-09-22T02:00:00.000Z')
const item = {
  category: '主材',
  name: '地砖',
  unit: '平方米',
  unitPrice: '100.00',
  quantity: '20',
  productId: null,
  description: null,
  image: null,
  sort: 1,
}
const row = {
  ...item,
  id: 1,
  projectId: 1,
  unitPrice: new Prisma.Decimal(item.unitPrice),
  quantity: new Prisma.Decimal(item.quantity),
  createdAt: now,
  updatedAt: now,
}
function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectNo: 'ZX1',
    name: '厨房改造',
    appointmentId: null,
    userId: null,
    customerName: '张先生',
    mobile: '13800138000',
    serviceAddress: '',
    employeeId: null,
    employee: null,
    planId: null,
    plan: null,
    quotedAmount: new Prisma.Decimal('2000'),
    contractAmount: null,
    quoteVersion: 1,
    quoteRemark: null,
    status: 'PENDING_CONFIRM',
    progress: '',
    remark: '',
    cancelReason: null,
    canceledAt: null,
    canceledByEmployeeId: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    quoteItems: [row],
    progresses: [],
    followUps: [],
    ...overrides,
  } as any
}
const dbError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('conflict', {
    code,
    clientVersion: '7.9.1',
  })
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
})
const body = (value: unknown, metatype: any) =>
  pipe.transform(value, { type: 'body', metatype })

describe('后台项目参数与金额映射', () => {
  it('默认分页及全状态筛选', async () => {
    expect(await body({}, QueryAdminProjectDto)).toEqual({
      pageNum: 1,
      pageSize: 10,
      status: 'ALL',
    })
    expect(
      await body(
        { pageNum: '2', pageSize: '20', status: 'CANCELED', keyword: ' 张 ' },
        QueryAdminProjectDto,
      ),
    ).toMatchObject({
      pageNum: 2,
      pageSize: 20,
      status: 'CANCELED',
      keyword: '张',
    })
  })
  it.each([
    { pageNum: 0 },
    { pageNum: 1.5 },
    { pageSize: 101 },
    { pageSize: 'abc' },
    { status: 'unknown' },
    { userId: 7 },
  ])('拒绝非法分页或筛选 %j', async (value) => {
    await expect(body(value, QueryAdminProjectDto)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
  it.each([
    { name: ' ' },
    { mobile: '123' },
    { employeeId: -1 },
    { status: 'COMPLETED' },
  ])('新建项目拒绝非法或越权字段 %j', async (value) => {
    await expect(
      body(
        { name: '厨房', customerName: '张', mobile: '13800138000', ...value },
        CreateAdminProjectDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
  it.each([
    { userId: 7 },
    { planId: 2 },
    { employeeId: 2 },
    { name: null },
    { name: ' ' },
  ])('编辑不允许改变关联或清空必填字段 %j', async (value) => {
    await expect(body(value, EditAdminProjectDto)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
  it.each([
    { items: [] },
    { quoteVersion: undefined },
    { quoteVersion: 0 },
    { items: [{ ...item, unitPrice: '-1' }] },
    { items: [{ ...item, quantity: '0' }] },
    { items: [{ ...item, quantity: '0.001' }] },
    { items: [{ ...item, category: '其他' }] },
    { items: [{ ...item, name: ' ' }] },
    { items: [{ ...item, productId: -1 }] },
    { items: [{ ...item, productId: 1.5 }] },
    { items: [{ ...item, productId: 2147483648 }] },
    { items: [{ ...item, name: '字'.repeat(192) }] },
    { items: [{ ...item, unit: '字'.repeat(192) }] },
    { items: [{ ...item, amount: '2000' }] },
    { items: [{ ...item, id: 1 }] },
  ])('拒绝非法报价 %j', async (value) => {
    await expect(
      body({ quoteVersion: 1, items: [item], ...value }, SaveAdminQuotationDto),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
  it('进度和跟进拒绝空白内容及无效日期', async () => {
    await expect(
      body({ status: 'IN_SERVICE', content: ' ' }, AddProjectProgressDto),
    ).rejects.toThrow()
    await expect(
      body(
        { employeeId: 3, content: ' ', nextFollowAt: 'bad' },
        AddProjectFollowUpDto,
      ),
    ).rejects.toThrow()
    expect(
      await body(
        { employeeId: 3, content: ' 联系客户 ' },
        AddProjectFollowUpDto,
      ),
    ).toMatchObject({ content: '联系客户' })
  })
  it('每行四舍五入后汇总，不使用二进制浮点数', () => {
    expect(
      projectQuoteTotal([
        { unitPrice: '0.01', quantity: '0.50' },
        { unitPrice: '0.01', quantity: '0.50' },
      ]).toFixed(2),
    ).toBe('0.02')
    expect(() =>
      projectQuoteTotal([{ unitPrice: '99999999.99', quantity: '2' }]),
    ).toThrow(BadRequestException)
  })
  it('区分未报价、零报价及历史非零报价，并返回完整空数组', () => {
    expect(
      toAdminProject(
        project({ quoteItems: [], quotedAmount: new Prisma.Decimal(0) }),
      ),
    ).toMatchObject({
      quotedAmount: null,
      contractAmount: null,
      employeeName: null,
      planName: null,
      items: [],
      followUps: [],
      progressRecords: [],
      createdAt: now.toISOString(),
    })
    expect(
      toAdminProject(project({ quotedAmount: new Prisma.Decimal(0) })),
    ).toMatchObject({ quotedAmount: '0.00' })
    expect(toAdminProject(project({ quoteItems: [] }))).toMatchObject({
      quotedAmount: '2000.00',
    })
    expect(toAdminProject(project())).toMatchObject({
      items: [
        expect.objectContaining({
          unitPrice: '100.00',
          quantity: '20',
          amount: '2000.00',
        }),
      ],
    })
    expect(toAdminProject(project(), false)).not.toHaveProperty('items')
  })
})

describe('后台装修项目业务', () => {
  let tx: any, db: any, service: AdminProjectService
  beforeEach(() => {
    tx = {
      renovationProject: {
        findUnique: jest.fn().mockResolvedValue(project()),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue(project()),
        create: jest.fn().mockResolvedValue(project()),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          status: true,
          user: { status: true, role: 'EMPLOYEE' },
        }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 20 }) },
      renewalPlan: { findUnique: jest.fn().mockResolvedValue({ id: 5 }) },
      product: { count: jest.fn().mockResolvedValue(1) },
      projectQuoteItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      followUp: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          appointmentId: null,
          projectId: 1,
          employeeId: 3,
          content: '联系客户',
          nextFollowAt: null,
          createdAt: now,
        }),
      },
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10,
          customerName: '张先生',
          mobile: '13800138000',
          visitAddress: '上海',
          employeeId: null,
          userId: 20,
          planId: 5,
          type: 'PLAN',
          status: 'COMPLETED',
          updatedAt: now,
          snapshot: { items: [item] },
        }),
        update: jest.fn(),
      },
    }
    db = {
      ...tx,
      $transaction: jest.fn(async (work) =>
        typeof work === 'function' ? work(tx) : Promise.all(work),
      ),
    }
    service = new AdminProjectService(db)
  })

  it('列表和数量使用相同条件，并稳定分页', async () => {
    const result = await service.list({
      pageNum: 2,
      pageSize: 5,
      keyword: '张',
      owner: '李',
      status: 'IN_SERVICE',
    })
    const args = tx.renovationProject.findMany.mock.calls[0][0]
    expect(args).toMatchObject({
      skip: 5,
      take: 5,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: {
        status: 'IN_SERVICE',
        OR: [
          { name: { contains: '张' } },
          { customerName: { contains: '张' } },
        ],
        employee: { is: { user: { is: { realName: { contains: '李' } } } } },
      },
    })
    expect(tx.renovationProject.count).toHaveBeenCalledWith({
      where: args.where,
    })
    expect(result).toEqual({
      list: [],
      total: 0,
      pageNum: 2,
      pageSize: 5,
      totalPage: 0,
    })
  })
  it('新增项目允许无关联，编号由后台生成且默认未报价', async () => {
    await service.create({
      name: '厨房',
      customerName: '张先生',
      mobile: '13800138000',
    })
    expect(tx.renovationProject.create.mock.calls[0][0].data).toMatchObject({
      projectNo: expect.stringMatching(/^ZX\d{17}[A-F0-9]{10}$/),
      status: 'PENDING_CONFIRM',
      quotedAmount: 0,
      serviceAddress: '',
      remark: '',
    })
  })
  it.each(['employee', 'user', 'renewalPlan'])(
    '拒绝无效关联 %s',
    async (model) => {
      tx[model].findUnique.mockResolvedValue(null)
      await expect(
        service.create({
          name: '厨房',
          customerName: '张先生',
          mobile: '13800138000',
          employeeId: 3,
          userId: 20,
          planId: 5,
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(tx.renovationProject.create).not.toHaveBeenCalled()
    },
  )
  it('改派只更新项目负责人，不更改历史跟进或预约', async () => {
    await service.assign(1, 3)
    expect(tx.renovationProject.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { employeeId: 3, updatedAt: expect.any(Date) },
      }),
    )
    expect(tx.followUp.create).not.toHaveBeenCalled()
    expect(tx.appointment.update).not.toHaveBeenCalled()
  })
  it.each([
    { status: false, user: { status: true, role: 'EMPLOYEE' } },
    { status: true, user: { status: false, role: 'EMPLOYEE' } },
    { status: true, user: { status: true, role: 'CUSTOMER' } },
  ])('改派拒绝无效员工 %j', async (employee) => {
    tx.employee.findUnique.mockResolvedValue(employee)
    await expect(service.assign(1, 3)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(tx.renovationProject.update).not.toHaveBeenCalled()
  })
  it.each(['IN_SERVICE', 'COMPLETED', 'CANCELED', 'PENDING_QUOTE'])(
    '状态 %s 不允许改报价',
    async (status) => {
      tx.renovationProject.findUnique.mockResolvedValue(project({ status }))
      await expect(
        service.quotation(1, { quoteVersion: 1, items: [item] }),
      ).rejects.toBeInstanceOf(ConflictException)
      expect(tx.projectQuoteItem.deleteMany).not.toHaveBeenCalled()
    },
  )
  it('过期报价版本不能覆盖报价', async () => {
    await expect(
      service.quotation(1, { quoteVersion: 2, items: [item] }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(tx.renovationProject.update).not.toHaveBeenCalled()
  })
  it('报价替换先锁定状态和版本，再更新明细及金额', async () => {
    await service.quotation(1, { quoteVersion: 1, items: [item] })
    expect(tx.renovationProject.update.mock.calls[0][0].where).toMatchObject({
      id: 1,
      status: 'PENDING_CONFIRM',
      quoteVersion: 1,
      employeeId: null,
      updatedAt: now,
    })
    expect(tx.renovationProject.update.mock.calls[1][0].data).toEqual({
      quotedAmount: new Prisma.Decimal('2000'),
      quoteVersion: { increment: 1 },
      updatedAt: expect.any(Date),
    })
    expect(tx.projectQuoteItem.createMany).toHaveBeenCalledWith({
      data: [{ ...item, projectId: 1 }],
    })
    expect(tx.renewalPlan.findUnique).not.toHaveBeenCalled()
  })
  it('锁定时并发确认失败不删除明细', async () => {
    tx.renovationProject.update.mockRejectedValue(dbError('P2025'))
    await expect(
      service.quotation(1, { quoteVersion: 1, items: [item] }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(tx.projectQuoteItem.deleteMany).not.toHaveBeenCalled()
  })
  it('明细失败向事务传播，不返回部分成功', async () => {
    const error = new Error('write failed')
    tx.projectQuoteItem.createMany.mockRejectedValue(error)
    await expect(
      service.quotation(1, { quoteVersion: 1, items: [item] }),
    ).rejects.toBe(error)
    expect(tx.renovationProject.findUnique).toHaveBeenCalledTimes(1)
  })
  it('同毫秒更新也推进版本时间戳，防止后续写入覆盖锁标记', async () => {
    jest.useFakeTimers().setSystemTime(now)
    try {
      await service.edit(1, { name: '新项目名' })
      expect(
        tx.renovationProject.update.mock.calls[0][0].data.updatedAt.getTime(),
      ).toBe(now.getTime() + 1)
      expect(
        tx.renovationProject.update.mock.calls[1][0].data.updatedAt.getTime(),
      ).toBe(now.getTime() + 1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('管理员可确认不同合同金额并原子保存进度', async () => {
    await service.progress(
      1,
      {
        status: 'IN_SERVICE',
        content: '客户线下确认',
        quoteVersion: 1,
        contractAmount: '1800.00',
      },
      9,
    )
    expect(tx.renovationProject.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          status: 'IN_SERVICE',
          progress: '客户线下确认',
          updatedAt: expect.any(Date),
          contractAmount: new Prisma.Decimal('1800'),
          progresses: {
            create: {
              status: 'IN_SERVICE',
              content: '客户线下确认',
              createdBy: 'admin:9',
            },
          },
        },
      }),
    )
  })
  it.each([{ quoteVersion: undefined }, { contractAmount: undefined }])(
    '确认缺少必要参数 %j',
    async (patch) => {
      await expect(
        service.progress(
          1,
          {
            status: 'IN_SERVICE',
            content: '确认',
            quoteVersion: 1,
            contractAmount: '0',
            ...patch,
          },
          9,
        ),
      ).rejects.toBeInstanceOf(BadRequestException)
    },
  )
  it('未报价和过期版本不可确认', async () => {
    await expect(
      service.progress(
        1,
        {
          status: 'IN_SERVICE',
          content: '确认',
          quoteVersion: 2,
          contractAmount: '0',
        },
        9,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
    tx.renovationProject.findUnique.mockResolvedValue(
      project({ quoteItems: [] }),
    )
    await expect(
      service.progress(
        1,
        {
          status: 'IN_SERVICE',
          content: '确认',
          quoteVersion: 1,
          contractAmount: '0',
        },
        9,
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
  it.each([
    ['PENDING_CONFIRM', 'COMPLETED'],
    ['COMPLETED', 'IN_SERVICE'],
    ['IN_SERVICE', 'PENDING_CONFIRM'],
    ['CANCELED', 'PENDING_CONFIRM'],
    ['PENDING_QUOTE', 'PENDING_CONFIRM'],
  ])('拒绝状态跳转 %s → %s', async (from, to) => {
    tx.renovationProject.findUnique.mockResolvedValue(project({ status: from }))
    await expect(
      service.progress(1, { status: to as any, content: '进度' }, 9),
    ).rejects.toBeInstanceOf(ConflictException)
  })
  it.each(['PENDING_CONFIRM', 'IN_SERVICE', 'COMPLETED'] as const)(
    '同状态 %s 可追加说明但不能改合同金额',
    async (status) => {
      tx.renovationProject.findUnique.mockResolvedValue(project({ status }))
      await service.progress(1, { status, content: '进度' }, 9)
      expect(
        tx.renovationProject.update.mock.calls[1][0].data,
      ).not.toHaveProperty('completedAt')
      await expect(
        service.progress(
          1,
          { status, content: '进度', contractAmount: '1' },
          9,
        ),
      ).rejects.toBeInstanceOf(BadRequestException)
    },
  )
  it('首次完成记录完成时间', async () => {
    tx.renovationProject.findUnique.mockResolvedValue(
      project({ status: 'IN_SERVICE' }),
    )
    await service.progress(1, { status: 'COMPLETED', content: '验收完成' }, 9)
    expect(tx.renovationProject.update.mock.calls[1][0].data).toMatchObject({
      completedAt: expect.any(Date),
    })
  })
  it('未分配和不匹配负责人均不可跟进', async () => {
    await expect(
      service.followUp(1, { employeeId: 3, content: '联系客户' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    tx.renovationProject.findUnique.mockResolvedValue(
      project({ employeeId: 2 }),
    )
    await expect(
      service.followUp(1, { employeeId: 3, content: '联系客户' }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(tx.followUp.create).not.toHaveBeenCalled()
  })
  it('仅当前负责人跟进且并发改派时不写入', async () => {
    tx.renovationProject.findUnique.mockResolvedValue(
      project({ employeeId: 3 }),
    )
    const result = await service.followUp(1, {
      employeeId: 3,
      content: '联系客户',
    })
    expect(result).toMatchObject({
      appointmentId: null,
      projectId: 1,
      employeeId: 3,
      nextFollowAt: null,
      createdAt: now.toISOString(),
    })
    tx.followUp.create.mockClear()
    tx.renovationProject.update.mockRejectedValue(dbError('P2025'))
    await expect(
      service.followUp(1, { employeeId: 3, content: '联系客户' }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(tx.followUp.create).not.toHaveBeenCalled()
  })

  describe('预约转换', () => {
    beforeEach(() => tx.renovationProject.findUnique.mockResolvedValue(null))
    it('复制快照与关联，不取当前商品价格或预估报价', async () => {
      await service.convert(10, { projectName: '厨房改造', remark: '备注' })
      expect(tx.renovationProject.create.mock.calls[0][0].data).toMatchObject({
        appointmentId: 10,
        userId: 20,
        employeeId: null,
        planId: 5,
        serviceAddress: '上海',
        quotedAmount: new Prisma.Decimal('2000'),
        quoteItems: { create: [item] },
      })
      expect(tx.appointment.update.mock.calls[0][0].data).not.toHaveProperty(
        'status',
      )
      expect(tx.followUp.create).not.toHaveBeenCalled()
    })
    it('重复转换直接返回已有项目，不覆盖名称和报价', async () => {
      tx.renovationProject.findUnique.mockResolvedValue(project())
      expect(
        await service.convert(10, { projectName: '重复转换' }),
      ).toMatchObject({ name: '厨房改造' })
      expect(tx.renovationProject.create).not.toHaveBeenCalled()
    })
    it.each(['PENDING_CONTACT', 'PENDING_VISIT', 'CANCELED'])(
      '预约状态 %s 不允许转换',
      async (status) => {
        const source = await tx.appointment.findUnique()
        tx.appointment.findUnique.mockResolvedValue({ ...source, status })
        await expect(
          service.convert(10, { projectName: '项目' }),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(tx.renovationProject.create).not.toHaveBeenCalled()
      },
    )
    it.each(['BUDGET', 'QUOTE'])(
      '报价类预约 %s 必须有有效预估报价',
      async (type) => {
        const source = await tx.appointment.findUnique()
        tx.appointment.findUnique.mockResolvedValue({
          ...source,
          type,
          estimatedAmount: new Prisma.Decimal(0),
        })
        await expect(
          service.convert(10, { projectName: '项目' }),
        ).rejects.toBeInstanceOf(BadRequestException)
        tx.appointment.findUnique.mockResolvedValue({
          ...source,
          type,
          estimatedAmount: new Prisma.Decimal(9999),
        })
        await service.convert(10, { projectName: '项目' })
        expect(
          tx.renovationProject.create.mock.calls[0][0].data.quotedAmount.toString(),
        ).toBe('2000')
      },
    )
    it('无快照生成未报价项目；非法快照拒绝转换', async () => {
      const source = await tx.appointment.findUnique()
      tx.appointment.findUnique.mockResolvedValue({ ...source, snapshot: null })
      await service.convert(10, { projectName: '项目' })
      expect(tx.renovationProject.create.mock.calls[0][0].data).toMatchObject({
        quotedAmount: new Prisma.Decimal(0),
        quoteItems: { create: [] },
      })
      tx.appointment.findUnique.mockResolvedValue({
        ...source,
        snapshot: { items: [{ ...item, quantity: '-1' }] },
      })
      await expect(
        service.convert(10, { projectName: '项目' }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
    it('并发事务回滚后重试转换并返回已有项目', async () => {
      db.$transaction.mockRejectedValueOnce(dbError('P2034'))
      tx.renovationProject.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(project())
      expect(await service.convert(10, { projectName: '项目' })).toMatchObject({
        id: 1,
      })
      expect(db.$transaction).toHaveBeenCalledTimes(2)
      expect(tx.renovationProject.create).not.toHaveBeenCalled()
    })
    it('预约缺少姓名或手机号不写入项目', async () => {
      const source = await tx.appointment.findUnique()
      for (const patch of [{ customerName: ' ' }, { mobile: '' }]) {
        tx.appointment.findUnique.mockResolvedValue({ ...source, ...patch })
        await expect(
          service.convert(10, { projectName: '项目' }),
        ).rejects.toBeInstanceOf(BadRequestException)
      }
      expect(tx.renovationProject.create).not.toHaveBeenCalled()
    })

    it('并发唯一约束冲突后读取同一个项目', async () => {
      tx.renovationProject.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(project())
      tx.renovationProject.create.mockRejectedValue(dbError('P2002'))
      expect(await service.convert(10, { projectName: '项目' })).toMatchObject({
        id: 1,
      })
    })
  })
})
