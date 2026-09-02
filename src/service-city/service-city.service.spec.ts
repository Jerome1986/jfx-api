import { BadRequestException, NotFoundException } from '@nestjs/common'

jest.mock('./service-city.repository', () => ({ ServiceCityRepository: class ServiceCityRepository {} }))

import { ServiceCityRepository } from './service-city.repository'
import { ServiceCityService } from './service-city.service'

describe('ServiceCityService', () => {
  const city = {
    id: 1,
    name: '杭州市',
    code: '330100',
    sort: 0,
    status: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  let repository: jest.Mocked<ServiceCityRepository>
  let service: ServiceCityService

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findEnabled: jest.fn(),
      findOne: jest.fn(),
      findConflict: jest.fn(),
      update: jest.fn(),
      updateWithOutletNames: jest.fn(),
      countOutlets: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<ServiceCityRepository>
    service = new ServiceCityService(repository)
  })

  it('新增时使用标准名称和行政区划代码', async () => {
    repository.findConflict.mockResolvedValue(null)
    repository.create.mockResolvedValue(city)

    await service.create({ name: '杭州', sort: 2 })

    expect(repository.create).toHaveBeenCalledWith({ name: '杭州市', code: '330100', sort: 2 })
  })

  it('拒绝未知和重复城市', async () => {
    await expect(service.create({ name: '不存在市' })).rejects.toBeInstanceOf(BadRequestException)
    repository.findConflict.mockResolvedValue(city)
    await expect(service.create({ name: '杭州' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('修改名称时同步修改行政区划代码', async () => {
    repository.findOne.mockResolvedValue(city)
    repository.findConflict.mockResolvedValue(null)
    repository.updateWithOutletNames.mockResolvedValue({ ...city, name: '宁波市', code: '330200' })

    await service.update(1, { name: '宁波' })

    expect(repository.updateWithOutletNames).toHaveBeenCalledWith(1, { name: '宁波市', code: '330200' })
  })

  it('仅修改状态时不修改行政区划代码', async () => {
    repository.findOne.mockResolvedValue(city)
    repository.update.mockResolvedValue({ ...city, status: false })

    await service.update(1, { status: false })

    expect(repository.update).toHaveBeenCalledWith(1, { status: false })
  })

  it('返回分页信息', async () => {
    repository.findAll.mockResolvedValue([[city], 11])

    await expect(service.findAll({ pageNum: 2, pageSize: 5 })).resolves.toEqual({
      list: [city],
      total: 11,
      pageNum: 2,
      pageSize: 5,
      totalPage: 3,
    })
  })

  it('详情不存在时返回404', async () => {
    repository.findOne.mockResolvedValue(null)
    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('拒绝删除已关联服务网点的城市', async () => {
    repository.findOne.mockResolvedValue(city)
    repository.countOutlets.mockResolvedValue(1)
    await expect(service.remove(1)).rejects.toBeInstanceOf(BadRequestException)
    expect(repository.remove).not.toHaveBeenCalled()
  })

  it('删除无关联服务网点的城市', async () => {
    repository.findOne.mockResolvedValue(city)
    repository.countOutlets.mockResolvedValue(0)
    repository.remove.mockResolvedValue(city)
    await expect(service.remove(1)).resolves.toEqual(city)
  })
})
