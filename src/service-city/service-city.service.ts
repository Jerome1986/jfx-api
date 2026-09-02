import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateServiceCityDto } from './dto/create-service-city.dto'
import { QueryServiceCityDto } from './dto/query-service-city.dto'
import { UpdateServiceCityDto } from './dto/update-service-city.dto'
import { resolveServiceCityDivision } from './service-city-code.util'
import { ServiceCityRepository } from './service-city.repository'

@Injectable()
export class ServiceCityService {
  constructor(private readonly repository: ServiceCityRepository) {}

  // 解析并校验城市后创建城市记录。
  async create(dto: CreateServiceCityDto) {
    const division = this.resolveDivision(dto.name)
    await this.assertUnique(division.name, division.code)
    try {
      return await this.repository.create({ ...dto, ...division })
    } catch (error) {
      this.throwWriteError(error, '城市新增失败')
    }
  }

  // 查询城市分页数据并组装分页信息。
  async findAll(query: QueryServiceCityDto) {
    const [list, total] = await this.repository.findAll(query)
    return {
      list,
      total,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      totalPage: Math.ceil(total / query.pageSize),
    }
  }

  // 获取全部已启用的城市。
  findEnabled() {
    return this.repository.findEnabled()
  }

  // 查询城市详情并处理记录不存在的情况。
  async findOne(id: number) {
    const city = await this.repository.findOne(id)
    if (!city) throw new NotFoundException('城市不存在')
    return city
  }

  // 更新城市信息并在名称变化时同步更新 CODE。
  async update(id: number, dto: UpdateServiceCityDto) {
    await this.findOne(id)
    const data: UpdateServiceCityDto & { code?: string } = { ...dto }
    if (dto.name !== undefined) {
      const division = this.resolveDivision(dto.name)
      await this.assertUnique(division.name, division.code, id)
      data.name = division.name
      data.code = division.code
    }
    try {
      return data.name
        ? await this.repository.updateWithOutletNames(id, { ...data, name: data.name })
        : await this.repository.update(id, data)
    } catch (error) {
      this.throwWriteError(error, '城市更新失败')
    }
  }

  // 检查网点关联后物理删除城市。
  async remove(id: number) {
    await this.findOne(id)
    if ((await this.repository.countOutlets(id)) > 0) {
      throw new BadRequestException('城市已关联服务网点，请先停用或迁移网点')
    }
    try {
      return await this.repository.remove(id)
    } catch (error) {
      this.throwWriteError(error, '城市删除失败')
    }
  }

  // 将输入名称解析成唯一的标准行政区信息。
  private resolveDivision(name: string) {
    const division = resolveServiceCityDivision(name)
    if (!division) throw new BadRequestException('城市名称不在支持的行政区划范围内')
    return division
  }

  // 校验城市名称和行政区划代码是否重复。
  private async assertUnique(name: string, code: string, excludeId?: number) {
    if (await this.repository.findConflict(name, code, excludeId)) {
      throw new BadRequestException('城市名称或行政区划代码已存在')
    }
  }

  // 将 Prisma 写入异常转换为统一的业务异常。
  private throwWriteError(error: unknown, fallbackMessage: string): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new BadRequestException('城市名称或行政区划代码已存在')
    }
    throw new BadRequestException(fallbackMessage)
  }
}
