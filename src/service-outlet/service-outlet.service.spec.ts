import { BadRequestException, NotFoundException } from '@nestjs/common'

jest.mock('./service-outlet.repository', () => ({ ServiceOutletRepository: class ServiceOutletRepository {} }))

import { ServiceOutletRepository } from './service-outlet.repository'
import { ServiceOutletService } from './service-outlet.service'

describe('ServiceOutletService', () => {
  const city = { id: 1, name: '杭州市', code: '330100', status: true }
  const outlet = {
    id: 10,
    name: '杭州服务网点',
    businessHours: '09:00-18:00',
    cityId: 1,
    cityName: '杭州市',
    address: '测试地址',
  }
  let repository: jest.Mocked<ServiceOutletRepository>
  let service: ServiceOutletService

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByCity: jest.fn(),
      findOne: jest.fn(),
      findEnabledCity: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<ServiceOutletRepository>
    service = new ServiceOutletService(repository)
  })

  it('新增网点时根据 cityId 自动写入标准城市名称', async () => {
    repository.findEnabledCity.mockResolvedValue(city as never)
    repository.create.mockResolvedValue(outlet as never)

    await service.create({
      name: '杭州服务网点',
      businessHours: '09:00-18:00',
      cityId: 1,
      address: '测试地址',
    })

    expect(repository.create).toHaveBeenCalledWith({
      name: '杭州服务网点',
      businessHours: '09:00-18:00',
      cityId: 1,
      cityName: '杭州市',
      address: '测试地址',
    })
  })

  it('拒绝关联不存在或未启用的城市', async () => {
    repository.findEnabledCity.mockResolvedValue(null)
    await expect(
      service.create({ name: '测试网点', businessHours: '09:00-18:00', cityId: 99, address: '测试地址' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('修改 cityId 时同步更新 cityName', async () => {
    repository.findOne.mockResolvedValue(outlet as never)
    repository.findEnabledCity.mockResolvedValue(city as never)
    repository.update.mockResolvedValue(outlet as never)

    await service.update(10, { cityId: 1 })

    expect(repository.update).toHaveBeenCalledWith(10, { cityId: 1, cityName: '杭州市' })
  })

  it('按 cityId 查询小程序启用网点', async () => {
    repository.findByCity.mockResolvedValue([outlet] as never)
    await service.findByCity(1)
    expect(repository.findByCity).toHaveBeenCalledWith(1)
  })

  it('网点不存在时返回404', async () => {
    repository.findOne.mockResolvedValue(null)
    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException)
  })
})
