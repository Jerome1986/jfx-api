import 'reflect-metadata'
import { BadRequestException, ConflictException, NotFoundException, ParseIntPipe } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { RenovationProjectService } from './renovation-project.service'
import { RenovationProjectRepository } from './renovation-project.repository'
import { RenovationProjectController } from './renovation-project.controller'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'

describe('装修项目确认与详情', () => {
  const user = { userId: 7, type: 'user' } as UserJwtPayload
  const project = { id: 1, userId: 7, status: 'PENDING_CONFIRM', quoteVersion: 1, updatedAt: new Date(), quotedAmount: new Prisma.Decimal('123.45') }
  let repo: { findOne: jest.Mock; confirmProject: jest.Mock }
  let service: RenovationProjectService

  beforeEach(() => {
    repo = { findOne: jest.fn().mockResolvedValue(project), confirmProject: jest.fn().mockResolvedValue({ ...project, status: 'IN_SERVICE', contractAmount: project.quotedAmount }) }
    service = new RenovationProjectService(repo as unknown as RenovationProjectRepository)
  })

  it('详情与确认均要求用户登录', () => {
    for (const method of ['findOne', 'confirmProject']) {
      expect(Reflect.getMetadata('__guards__', RenovationProjectController.prototype[method])).toContain(UserJwtGuard)
    }
  })

  it('详情查询限定登录用户，不存在或不属于本人时返回 404', async () => {
    repo.findOne.mockResolvedValue(null)
    await expect(service.findOne(1, user)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.confirmProject(1, user, { quoteVersion: 1 })).rejects.toBeInstanceOf(NotFoundException)
    expect(repo.findOne).toHaveBeenCalledWith(1, 7)
    expect(repo.confirmProject).not.toHaveBeenCalled()
  })

  it.each([0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])('拒绝非法 ID %s', async (id) => {
    await expect(service.confirmProject(id, user, { quoteVersion: 1 })).rejects.toBeInstanceOf(BadRequestException)
    expect(repo.findOne).not.toHaveBeenCalled()
  })

  it('路径参数拒绝非整数文本', async () => {
    await expect(new ParseIntPipe().transform('abc', { type: 'param' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it.each(['CANCELED', 'COMPLETED', 'PENDING_QUOTE', 'IN_SERVICE'])('拒绝状态 %s，重复确认不再写入', async (status) => {
    repo.findOne.mockResolvedValue({ ...project, status })
    await expect(service.confirmProject(1, user, { quoteVersion: 1 })).rejects.toBeInstanceOf(ConflictException)
    expect(repo.confirmProject).not.toHaveBeenCalled()
  })

  it('金额相同但客户端版本过期时拒绝确认', async () => {
    repo.findOne.mockResolvedValue({ ...project, quoteVersion: 2 })
    await expect(service.confirmProject(1, user, { quoteVersion: 1 })).rejects.toBeInstanceOf(ConflictException)
    expect(repo.confirmProject).not.toHaveBeenCalled()
  })

  it('确认成功返回服务中项目及成交金额', async () => {
    await expect(service.confirmProject(1, user, { quoteVersion: 1 })).resolves.toMatchObject({ status: 'IN_SERVICE', contractAmount: project.quotedAmount })
  })

  it('并发取消、修改或删除导致更新未命中时返回 409', async () => {
    repo.confirmProject.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.9.1' }))
    await expect(service.confirmProject(1, user, { quoteVersion: 1 })).rejects.toBeInstanceOf(ConflictException)
  })

  it('不把其他数据库故障误报为状态冲突', async () => {
    const error = new Error('database unavailable')
    repo.confirmProject.mockRejectedValue(error)
    await expect(service.confirmProject(1, user, { quoteVersion: 1 })).rejects.toBe(error)
  })

  it('数据库写入同时约束归属、状态及报价快照，原子保存成交金额', async () => {
    const update = jest.fn().mockResolvedValue({})
    const repository = new RenovationProjectRepository({ renovationProject: { update } } as any)
    await repository.confirmProject(1, 7, project)
    expect(update).toHaveBeenCalledWith({
      where: { id: 1, userId: 7, status: 'PENDING_CONFIRM', quoteVersion: 1, updatedAt: project.updatedAt, quotedAmount: project.quotedAmount },
      data: { status: 'IN_SERVICE', contractAmount: project.quotedAmount },
    })
  })
})
