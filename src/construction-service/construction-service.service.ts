// 文件说明：施工服务业务服务，负责业务规则与流程编排。
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ConstructionServiceRepository } from './construction-service.repository'
import { CreateConstructionServiceDto } from './dto/create-construction-service.dto'
import { QueryConstructionServiceDto } from './dto/query-construction-service.dto'
import { UpdateConstructionServiceDto } from './dto/update-construction-service.dto'

@Injectable()
export class ConstructionServiceService {
  constructor(private constructionServiceRepo: ConstructionServiceRepository) {}

  // 新增施工服务
  async create(createDto: CreateConstructionServiceDto) {
    try {
      return await this.constructionServiceRepo.create(createDto)
    } catch {
      throw new BadRequestException('施工服务新增失败')
    }
  }

  // 分页查询施工服务列表
  async findAll(query: QueryConstructionServiceDto) {
    // 1. 查询当前页列表和总记录数
    const [list, total] = await this.constructionServiceRepo.findAll(query)

    // 2. 组装分页返回结果
    return {
      list,
      total,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      totalPage: Math.ceil(total / query.pageSize),
    }
  }

  // 查询施工服务详情
  async findOne(id: number) {
    const service = await this.constructionServiceRepo.findOne(id)
    if (!service) {
      throw new NotFoundException('施工服务不存在')
    }
    return service
  }

  // 更新施工服务
  async update(id: number, updateDto: UpdateConstructionServiceDto) {
    // 1. 检查施工服务是否存在
    await this.findOne(id)

    try {
      // 2. 更新施工服务信息
      return await this.constructionServiceRepo.update(id, updateDto)
    } catch {
      throw new BadRequestException('施工服务更新失败')
    }
  }

  // 逻辑停用施工服务
  async remove(id: number) {
    // 1. 检查施工服务是否存在
    await this.findOne(id)

    try {
      // 2. 将施工服务状态更新为停用
      return await this.constructionServiceRepo.disable(id)
    } catch {
      throw new BadRequestException('施工服务停用失败')
    }
  }
}
