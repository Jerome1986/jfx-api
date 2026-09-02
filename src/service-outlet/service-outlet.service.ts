// 文件说明：服务网点业务服务，负责业务校验和流程编排。
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateServiceOutletDto } from './dto/create-service-outlet.dto'
import { QueryServiceOutletDto } from './dto/query-service-outlet.dto'
import { UpdateServiceOutletDto } from './dto/update-service-outlet.dto'
import { ServiceOutletRepository } from './service-outlet.repository'

@Injectable()
export class ServiceOutletService {
  constructor(private repository: ServiceOutletRepository) { }

  // 新增服务网点
  async create(dto: CreateServiceOutletDto) {
    const city = await this.findEnabledCity(dto.cityId)
    try {
      return await this.repository.create({ ...dto, cityName: city.name })
    } catch {
      throw new BadRequestException('服务网点新增失败')
    }
  }

  // 分页查询服务网点列表并组装分页数据
  async findAll(query: QueryServiceOutletDto) {
    const [list, total] = await this.repository.findAll(query)

    return { list, total, pageNum: query.pageNum, pageSize: query.pageSize, totalPage: Math.ceil(total / query.pageSize) }
  }

  // 小程序端根据城市 ID 获取已启用的服务网点
  findByCity(cityId: number) {
    return this.repository.findByCity(cityId)
  }

  // 根据 ID 查询服务网点详情，不存在时抛出 404 异常
  async findOne(id: number) {
    const outlet = await this.repository.findOne(id)
    if (!outlet) throw new NotFoundException('服务网点不存在')
    return outlet
  }

  // 更新指定服务网点，更新前检查网点是否存在
  async update(id: number, dto: UpdateServiceOutletDto) {
    await this.findOne(id)
    const data: UpdateServiceOutletDto & { cityName?: string } = { ...dto }
    if (dto.cityId !== undefined) {
      const city = await this.findEnabledCity(dto.cityId)
      data.cityName = city.name
    }
    try {
      return await this.repository.update(id, data)
    } catch {
      throw new BadRequestException('服务网点更新失败')
    }
  }

  // 删除指定服务网点，删除前检查网点是否存在
  async remove(id: number) {
    await this.findOne(id)
    try {
      return await this.repository.remove(id)
    } catch {
      throw new BadRequestException('服务网点删除失败')
    }
  }

  // 查询并校验服务城市存在且处于启用状态。
  private async findEnabledCity(cityId: number) {
    const city = await this.repository.findEnabledCity(cityId)
    if (!city) throw new BadRequestException('服务城市不存在或未启用')
    return city
  }
}
