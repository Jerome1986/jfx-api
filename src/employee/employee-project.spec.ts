import 'reflect-metadata'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { EmployeeService } from './employee.service'
import { EmployeeRepository } from './employee.repository'
import { QueryEmployeeProjectDto } from './dto/query-employee-project.dto'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
const validate = (query: unknown): Promise<QueryEmployeeProjectDto> => pipe.transform(query, { type: 'query', metatype: QueryEmployeeProjectDto })

describe('员工装修订单', () => {
  const user = { userId: 7, role: 'EMPLOYEE', type: 'user' } as UserJwtPayload
  const employee = { id: 21, status: true, user: { role: 'EMPLOYEE', status: true } }
  let repo: { findByUserId: jest.Mock; findProjects: jest.Mock; findProject: jest.Mock; completeProject: jest.Mock }
  let service: EmployeeService
  beforeEach(() => {
    repo = { findByUserId: jest.fn().mockResolvedValue(employee), findProjects: jest.fn().mockResolvedValue([[], 0]), findProject: jest.fn().mockResolvedValue(null), completeProject: jest.fn() }
    service = new EmployeeService(repo as unknown as EmployeeRepository, {} as any, {} as any, {} as any, {} as any)
  })

  it('默认分页并转换字符串参数', async () => {
    expect(await validate({})).toEqual({ status: 'ALL', pageNum: 1, pageSize: 10 })
    expect(await validate({ status: 'CANCELED', pageNum: '2', pageSize: '20' })).toEqual({ status: 'CANCELED', pageNum: 2, pageSize: 20 })
  })

  it.each([{ status: 'INVALID' }, { pageNum: '0' }, { pageNum: '1.5' }, { pageSize: '101' }, { pageSize: 'abc' }, { employeeId: '22' }])('拒绝非法或越权查询参数 %j', async (query) => {
    await expect(validate(query)).rejects.toThrow()
  })

  it('用员工档案 ID 查询并返回分页结果', async () => {
    repo.findProjects.mockResolvedValue([[{ id: 3 }], 11])
    await expect(service.findProjects(new QueryEmployeeProjectDto(), user)).resolves.toEqual({ list: [{ id: 3 }], total: 11, pageNum: 1, pageSize: 10, totalPage: 2 })
    expect(repo.findProjects).toHaveBeenCalledWith(21, new QueryEmployeeProjectDto())
  })

  it('管理员 ID 与员工用户 ID 重合时仍拒绝员工入口', async () => {
    const admin = { ...user, type: 'admin' } as unknown as UserJwtPayload
    await expect(service.findProjects(new QueryEmployeeProjectDto(), admin)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.findProject(3, admin)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.completeProject(3, admin)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.CreateProject({} as any, admin)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.findByUserId).not.toHaveBeenCalled()
  })

  it('普通用户不能读取员工订单', async () => {
    await expect(service.findProjects(new QueryEmployeeProjectDto(), { ...user, role: 'CUSTOMER' } as UserJwtPayload)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.findProjects).not.toHaveBeenCalled()
  })

  it.each([null, { ...employee, status: false }, { ...employee, user: { role: 'EMPLOYEE', status: false } }, { ...employee, user: { role: 'CUSTOMER', status: true } }])('拒绝不可用员工档案 %j', async (record) => {
    repo.findByUserId.mockResolvedValue(record)
    await expect(service.findProjects(new QueryEmployeeProjectDto(), user)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.findProjects).not.toHaveBeenCalled()
  })

  it('其他员工或不存在的项目返回 404', async () => {
    await expect(service.findProject(3, user)).rejects.toBeInstanceOf(NotFoundException)
    expect(repo.findProject).toHaveBeenCalledWith(3, 21)
  })

  it('完成服务中项目并返回更新后的项目', async () => {
    repo.findProject.mockResolvedValue({ id: 3, employeeId: 21, status: 'IN_SERVICE' })
    const completed = { id: 3, employeeId: 21, status: 'COMPLETED', completedAt: new Date() }
    repo.completeProject.mockResolvedValue(completed)
    await expect(service.completeProject(3, user)).resolves.toEqual(completed)
    expect(repo.findProject).toHaveBeenCalledWith(3, 21)
    expect(repo.completeProject).toHaveBeenCalledWith(3, 21)
  })

  it.each(['COMPLETED', 'CANCELED', 'PENDING_QUOTE', 'PENDING_CONFIRM'])('状态 %s 不允许完成且不写入', async (status) => {
    repo.findProject.mockResolvedValue({ id: 3, employeeId: 21, status })
    await expect(service.completeProject(3, user)).rejects.toBeInstanceOf(ConflictException)
    expect(repo.completeProject).not.toHaveBeenCalled()
  })

  it('不能完成不存在或其他员工负责的项目', async () => {
    await expect(service.completeProject(3, user)).rejects.toBeInstanceOf(NotFoundException)
    expect(repo.findProject).toHaveBeenCalledWith(3, 21)
    expect(repo.completeProject).not.toHaveBeenCalled()
  })

  it('普通用户不能完成项目', async () => {
    await expect(service.completeProject(3, { ...user, role: 'CUSTOMER' } as UserJwtPayload)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.findProject).not.toHaveBeenCalled()
    expect(repo.completeProject).not.toHaveBeenCalled()
  })

  it.each([null, { ...employee, status: false }, { ...employee, user: { role: 'EMPLOYEE', status: false } }, { ...employee, user: { role: 'CUSTOMER', status: true } }])('不可用员工不能完成项目 %j', async (record) => {
    repo.findByUserId.mockResolvedValue(record)
    await expect(service.completeProject(3, user)).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.findProject).not.toHaveBeenCalled()
    expect(repo.completeProject).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, NaN, Infinity, 2147483648])('完成项目拒绝非法 ID %s', async (id) => {
    await expect(service.completeProject(id, user)).rejects.toBeInstanceOf(BadRequestException)
    expect(repo.findProject).not.toHaveBeenCalled()
    expect(repo.completeProject).not.toHaveBeenCalled()
  })

  it('并发状态或归属变化导致更新失败时返回 409', async () => {
    repo.findProject.mockResolvedValue({ id: 3, employeeId: 21, status: 'IN_SERVICE' })
    repo.completeProject.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.9.1' }))
    await expect(service.completeProject(3, user)).rejects.toBeInstanceOf(ConflictException)
  })

  it('保留其他数据库异常', async () => {
    repo.findProject.mockResolvedValue({ id: 3, employeeId: 21, status: 'IN_SERVICE' })
    const error = new Error('Database unavailable')
    repo.completeProject.mockRejectedValue(error)
    await expect(service.completeProject(3, user)).rejects.toBe(error)
  })

  it('完成更新限定员工和服务中状态，原子保存完成时间及进度', async () => {
    const now = new Date('2026-09-15T08:00:00.000Z')
    jest.useFakeTimers().setSystemTime(now)
    try {
      const update = jest.fn().mockResolvedValue({ id: 3, status: 'COMPLETED', completedAt: now })
      const repository = new EmployeeRepository({ renovationProject: { update } } as any)
      await expect(repository.completeProject(3, 21)).resolves.toEqual({ id: 3, status: 'COMPLETED', completedAt: now })
      expect(update).toHaveBeenCalledWith({
        omit: { remark: true, progress: true },
        where: { id: 3, employeeId: 21, status: 'IN_SERVICE' },
        data: { status: 'COMPLETED', completedAt: now, progress: '员工已确认项目完工', progresses: { create: { status: 'COMPLETED', content: '员工已确认项目完工', createdBy: 'employee:21' } } },
      })
    } finally {
      jest.useRealTimers()
    }
  })

  it('列表与总数查询使用相同的员工和状态限制', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const repository = new EmployeeRepository({ renovationProject: { findMany, count } } as any)
    await repository.findProjects(21, await validate({ status: 'IN_SERVICE', pageNum: '2', pageSize: '5' }))
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: 21, status: 'IN_SERVICE' }, skip: 5, take: 5 }))
    expect(count).toHaveBeenCalledWith({ where: { employeeId: 21, status: 'IN_SERVICE' } })
    await repository.findProjects(21, new QueryEmployeeProjectDto())
    expect(count).toHaveBeenLastCalledWith({ where: { employeeId: 21 } })
  })
})
