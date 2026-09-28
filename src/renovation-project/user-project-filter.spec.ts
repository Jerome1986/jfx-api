import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { ProjectStatus, QueryUserRenovationProjectDto } from './dto/query-user-renovation-project.dto'
import { RenovationProjectRepository } from './renovation-project.repository'

describe('客户已取消项目筛选', () => {
  it('查询 DTO 接受 CANCELED，继续拒绝未知状态', async () => {
    const pipe = new ValidationPipe({ transform: true })
    await expect(pipe.transform({ status: 'CANCELED' }, { type: 'query', metatype: QueryUserRenovationProjectDto })).resolves.toMatchObject({ status: 'CANCELED' })
    await expect(pipe.transform({ status: 'INVALID' }, { type: 'query', metatype: QueryUserRenovationProjectDto })).rejects.toThrow()
  })

  it('列表和总数都限定当前用户及取消状态，按服务端分页', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 12, status: 'CANCELED' }])
    const count = jest.fn().mockResolvedValue(11)
    const repo = new RenovationProjectRepository({ renovationProject: { findMany, count } } as any)
    const result = await repo.findAllByUser(7, ProjectStatus.CANCELED, 2, 10)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7, status: 'CANCELED' }, skip: 10, take: 10 }))
    expect(count).toHaveBeenCalledWith({ where: { userId: 7, status: 'CANCELED' } })
    expect(result).toEqual([[{ id: 12, status: 'CANCELED' }], 11])
  })
})
