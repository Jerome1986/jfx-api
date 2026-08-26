// 文件说明：案例业务服务，负责业务规则与流程编排。
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCaseDto } from './dto/create-case.dto';
import { caseRepository } from './case.repository';
import { UpdateCaseDto } from './dto/update-case.dto';
import { PublishStatus } from '../../generated/prisma/enums';
import { SearchCaseQueryDto } from './dto/search-case-query.dto';

@Injectable()
export class CaseService {
  constructor(private caseRepo: caseRepository) { }

  // 新增案例
  async createCase(createCaseDto: CreateCaseDto) {
    const res = await this.caseRepo.createCase(createCaseDto)

    return {
      caseId: res.id
    }
  }

  // 获取所有案例
  async findAllCase(pageNum: number, pageSize: number, userId?: number) {
    const [data, total] = await this.caseRepo.findAllCase(pageNum, pageSize, userId)
    const list = data.map(({ favorites, ...item }) => ({
      ...item,
      isFavorite: favorites.length > 0
    }))
    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
    }
  }

  // 搜索案例
  async searchCase(query: SearchCaseQueryDto) {
    const [list, total] = await this.caseRepo.searchCase(query)

    return {
      list,
      total,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      totalPage: Math.ceil(total / query.pageSize),
    }
  }

  // 更新案例
  async updateCaseDto(id: number, updateCaseDto: UpdateCaseDto) {
    const res = await this.caseRepo.updateCase(id, updateCaseDto)

    return {
      caseId: res.id
    }
  }

  // 更新案例状态
  changeStauts(id: number, status: PublishStatus) {
    return this.caseRepo.changeStauts(id, status)
  }

  // 首页推荐
  isRecommendedByHome(id: number, isRecommended: boolean) {
    return this.caseRepo.isRecommendedByHome(id, isRecommended)
  }

  // 案例详情
  async findOne(id: number, userId?: number) {
    const res = await this.caseRepo.findOne(id, userId)
    if (!res) {
      throw new NotFoundException('案例不存在')
    }
    const { favorites, ...data } = res
    return {
      ...data,
      isFavorite: favorites.length > 0
    }
  }

  // 删除案例
  remove(id: number) {
    return this.caseRepo.remove(id)
  }
}
