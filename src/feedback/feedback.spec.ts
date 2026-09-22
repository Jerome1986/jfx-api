import 'reflect-metadata'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { FeedbackService } from './feedback.service'
import { FeedbackRepository } from './feedback.repository'
import { CreateFeedbackDto } from './dto/create-feedback.dto'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'

const actor: UserJwtPayload = { userId: 7, type: 'user', role: 'CUSTOMER' }
const dto = { type: '建议', content: '希望增加进度提醒' }
const conflict = () =>
  new Prisma.PrismaClientKnownRequestError('deadlock', {
    code: 'P2034',
    clientVersion: '7.9.1',
  })

describe('反馈提交事务', () => {
  let repo: any, db: any, tx: any, service: FeedbackService
  beforeEach(() => {
    tx = { user: { findUnique: jest.fn().mockResolvedValue({ status: true }) } }
    repo = {
      findOneByUser: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockResolvedValue({ id: 42, status: 'PENDING', ...dto }),
    }
    db = { $transaction: jest.fn(async (callback) => callback(tx)) }
    service = new FeedbackService(repo, db)
  })

  it('使用可串行化事务，主键交给数据库生成，查重和新增共用 tx', async () => {
    await expect(service.create(dto, actor)).resolves.toMatchObject({
      id: 42,
      status: 'PENDING',
    })
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    })
    expect(repo.findOneByUser).toHaveBeenCalledWith(7, tx)
    expect(repo.create).toHaveBeenCalledWith(
      { ...dto, userId: 7, feedbackNo: expect.any(String) },
      tx,
    )
  })

  it.each(['PENDING', 'PROCESSING'])(
    '已有 %s 反馈时返回 409，不吞掉异常',
    async (status) => {
      repo.findOneByUser.mockResolvedValue({ id: 1, status })
      await expect(service.create(dto, actor)).rejects.toBeInstanceOf(
        ConflictException,
      )
      expect(repo.create).not.toHaveBeenCalled()
      expect(db.$transaction).toHaveBeenCalledTimes(1)
    },
  )

  it('管理员 ID 与用户 ID 相同也不能提交', async () => {
    await expect(
      service.create(dto, {
        ...actor,
        type: 'admin',
      } as unknown as UserJwtPayload),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it.each([null, { status: false }])(
    '拒绝已删除或禁用用户 %j',
    async (account) => {
      tx.user.findUnique.mockResolvedValue(account)
      await expect(service.create(dto, actor)).rejects.toBeInstanceOf(
        ForbiddenException,
      )
      expect(repo.create).not.toHaveBeenCalled()
    },
  )

  it('提交阶段发生冲突时返回 409，不误报成功也不重试', async () => {
    db.$transaction.mockImplementationOnce(async (callback) => {
      await callback(tx)
      throw conflict()
    })
    await expect(service.create(dto, actor)).rejects.toMatchObject({
      status: 409, message: '提交冲突，请稍后重试',
    })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(repo.findOneByUser).toHaveBeenCalledTimes(1)
    expect(repo.create).toHaveBeenCalledTimes(1)
  })

  it('新增阶段发生冲突时返回 409，不重新新增', async () => {
    repo.create.mockRejectedValueOnce(conflict())
    await expect(service.create(dto, actor)).rejects.toMatchObject({
      status: 409, message: '提交冲突，请稍后重试',
    })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(repo.create).toHaveBeenCalledTimes(1)
  })

  it('事务启动失败时也返回 409，不进入查重和新增', async () => {
    db.$transaction.mockRejectedValue(conflict())
    await expect(service.create(dto, actor)).rejects.toMatchObject({ status: 409 })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(repo.findOneByUser).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
  })

  it.each(['findOneByUser', 'create'])(
    '%s 的普通数据库异常原样传播，不误报成功或重试',
    async (method) => {
      const error = new Error('database unavailable')
      repo[method].mockRejectedValue(error)
      await expect(service.create(dto, actor)).rejects.toBe(error)
      expect(db.$transaction).toHaveBeenCalledTimes(1)
    },
  )

  it('仓储仅查询当前用户未处理反馈，排除已回复及关闭记录', async () => {
    const transactionalDb = {
      feedback: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    }
    const fallbackDb = { feedback: { findFirst: jest.fn(), create: jest.fn() } }
    const repository = new FeedbackRepository(fallbackDb as any)
    await repository.findOneByUser(7, transactionalDb as any)
    expect(transactionalDb.feedback.findFirst).toHaveBeenCalledWith({
      where: { userId: 7, status: { in: ['PENDING', 'PROCESSING'] } },
    })
    const data = { ...dto, userId: 7, feedbackNo: 'test' }
    await repository.create(data, transactionalDb as any)
    expect(transactionalDb.feedback.create).toHaveBeenCalledWith({ data })
    expect(fallbackDb.feedback.findFirst).not.toHaveBeenCalled()
    expect(fallbackDb.feedback.create).not.toHaveBeenCalled()
  })
})

describe('反馈参数校验', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  })
  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: CreateFeedbackDto })

  it('去掉首尾空白并保留正文内部换行', async () => {
    expect(
      await validate({ type: ' 建议 ', content: ' 内容\n第二行 ' }),
    ).toEqual({ type: '建议', content: '内容\n第二行' })
  })
  it.each([
    { type: '' },
    { type: ' \t' },
    { type: null },
    { type: 1 },
    { type: '字'.repeat(192) },
    { content: '' },
    { content: '\n  ' },
    { content: null },
    { content: 1 },
    { content: '字'.repeat(5001) },
    { userId: 8 },
  ])('拒绝非法输入 %j', async (patch) => {
    await expect(validate({ ...dto, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
