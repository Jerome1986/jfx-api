import 'reflect-metadata'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { FeedbackService } from './feedback.service'
import { FeedbackRepository } from './feedback.repository'
import { ReplyFeedbackDto } from './dto/reply-feedback.dto'

// 验证管理员回复的权限、状态限制和参数校验
describe('管理员回复反馈', () => {
  const admin = { userId: 1, type: 'admin' }
  const dto = { reply: '已收到您的建议' }
  let repo: any, db: any, service: FeedbackService
  beforeEach(() => {
    repo = { findById: jest.fn().mockResolvedValue({ id: 2, status: 'PENDING' }), reply: jest.fn().mockResolvedValue({ id: 2, status: 'REPLIED' }) }
    db = { admin: { findUnique: jest.fn().mockResolvedValue({ status: true }) } }
    service = new FeedbackService(repo, db)
  })
  it.each(['PENDING', 'PROCESSING'])('允许回复 %s', async status => {
    repo.findById.mockResolvedValue({ id: 2, status })
    await expect(service.reply(2, dto, admin)).resolves.toMatchObject({ status: 'REPLIED' })
    expect(repo.reply).toHaveBeenCalledWith(2, dto.reply, 1)
  })
  it('拒绝普通用户', async () => {
    await expect(service.reply(2, dto, { ...admin, type: 'user' })).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.reply).not.toHaveBeenCalled()
  })
  it.each([null, { status: false }])('拒绝不存在或禁用的管理员 %j', async account => {
    db.admin.findUnique.mockResolvedValue(account)
    await expect(service.reply(2, dto, admin)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.reply).not.toHaveBeenCalled()
  })
  it('反馈不存在返回 404', async () => {
    repo.findById.mockResolvedValue(null)
    await expect(service.reply(2, dto, admin)).rejects.toBeInstanceOf(NotFoundException)
  })
  it.each(['REPLIED', 'CLOSED'])('拒绝回复 %s', async status => {
    repo.findById.mockResolvedValue({ id: 2, status })
    await expect(service.reply(2, dto, admin)).rejects.toBeInstanceOf(ConflictException)
    expect(repo.reply).not.toHaveBeenCalled()
  })
  it('并发状态变更返回 409', async () => {
    repo.reply.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('changed', { code: 'P2025', clientVersion: '7.9.1' }))
    await expect(service.reply(2, dto, admin)).rejects.toBeInstanceOf(ConflictException)
  })
  it('其他数据库异常原样抛出', async () => {
    const error = new Error('database unavailable')
    repo.reply.mockRejectedValue(error)
    await expect(service.reply(2, dto, admin)).rejects.toBe(error)
  })
  it('更新同时限制状态并记录回复人及完成时间', async () => {
    const update = jest.fn()
    const repository = new FeedbackRepository({ feedback: { update } } as any)
    await repository.reply(2, dto.reply, 1)
    expect(update).toHaveBeenCalledWith({
      where: { id: 2, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { reply: dto.reply, adminId: 1, status: 'REPLIED', completedAt: expect.any(Date) },
    })
  })
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: ReplyFeedbackDto })
  it('回复去除首尾空白', async () => {
    await expect(validate({ reply: ' 内容 ' })).resolves.toEqual({ reply: '内容' })
  })
  it.each([{}, { reply: '' }, { reply: '   ' }, { reply: null }, { reply: 1 }, { reply: '字'.repeat(5001) }, { ...dto, adminId: 9 }])('拒绝非法参数 %j', async body => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException)
  })
})
