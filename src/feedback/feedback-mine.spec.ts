import 'reflect-metadata'
import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common'
import { FeedbackService } from './feedback.service'
import { FeedbackRepository } from './feedback.repository'
import { QueryMyFeedbackDto } from './dto/query-my-feedback.dto'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'

describe('我的反馈记录', () => {
  const user: UserJwtPayload = { userId: 7, type: 'user', role: 'CUSTOMER' }
  const query = Object.assign(new QueryMyFeedbackDto(), { pageNum: 2, pageSize: 10 })
  let db: any, repo: any, service: FeedbackService
  beforeEach(() => {
    db = { user: { findUnique: jest.fn().mockResolvedValue({ status: true }) } }
    repo = { findMine: jest.fn().mockResolvedValue([[{ id: 2, status: 'REPLIED', reply: '已处理' }], 11]) }
    service = new FeedbackService(repo, db)
  })
  it('按登录用户查询并返回回复与分页信息', async () => {
    await expect(service.findMine(query, user)).resolves.toMatchObject({
      list: [{ status: 'REPLIED', reply: '已处理' }], total: 11, pageNum: 2, pageSize: 10, totalPage: 2,
    })
    expect(repo.findMine).toHaveBeenCalledWith(7, 2, 10)
  })
  it('无记录返回空列表和零页数', async () => {
    repo.findMine.mockResolvedValue([[], 0])
    await expect(service.findMine(query, user)).resolves.toMatchObject({ list: [], total: 0, totalPage: 0 })
  })
  it('拒绝管理员查询用户记录', async () => {
    await expect(service.findMine(query, { ...user, type: 'admin' } as unknown as UserJwtPayload)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.findMine).not.toHaveBeenCalled()
  })
  it.each([null, { status: false }])('拒绝不存在或禁用用户 %j', async account => {
    db.user.findUnique.mockResolvedValue(account)
    await expect(service.findMine(query, user)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.findMine).not.toHaveBeenCalled()
  })
  it('列表和总数均只查询本人，不过滤状态、不返回管理员字段', async () => {
    const feedback = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) }
    const repository = new FeedbackRepository({ feedback } as any)
    await repository.findMine(7, 2, 10)
    expect(feedback.findMany).toHaveBeenCalledWith({
      where: { userId: 7 },
      select: { id: true, feedbackNo: true, type: true, content: true, status: true, reply: true, createdAt: true, completedAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 10, take: 10,
    })
    expect(feedback.count).toHaveBeenCalledWith({ where: { userId: 7 } })
  })
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
  const validate = (value: unknown) => pipe.transform(value, { type: 'query', metatype: QueryMyFeedbackDto })
  it('默认页码和条数', async () => {
    await expect(validate({})).resolves.toEqual({ pageNum: 1, pageSize: 10 })
  })
  it('转换分页字符串', async () => {
    await expect(validate({ pageNum: '2', pageSize: '100' })).resolves.toEqual({ pageNum: 2, pageSize: 100 })
  })
  it.each([{ pageNum: '0' }, { pageNum: '-1' }, { pageNum: '1.5' }, { pageNum: 'abc' }, { pageSize: '101' }, { pageSize: '0' }, { pageSize: '' }, { userId: '8' }, { status: 'PENDING' }])('拒绝非法参数 %j', async value => {
    await expect(validate(value)).rejects.toBeInstanceOf(BadRequestException)
  })
})
