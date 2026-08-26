// 文件说明：续费方案业务服务，负责业务规则与流程编排。
import { Injectable } from '@nestjs/common'
import { CreateRenewalPlanDto } from './dto/create-renewal-plan.dto'
import { RenewalPlanRepository } from './renewal-plan.repository'
import { UpdateRenewalPlanDto } from './dto/update-renewal-plan.dto'

@Injectable()
export class RenewalPlanService {
  constructor(private renewalPlanRepo: RenewalPlanRepository) { }

  // 创建焕新方案，并返回新方案 ID
  async create(createRenewalPlanDto: CreateRenewalPlanDto) {
    const plan = await this.renewalPlanRepo.create(createRenewalPlanDto)

    return { planId: plan.id }
  }

  // 获取全部焕新方案
  findAll() {
    return this.renewalPlanRepo.findAll()
  }

  // 根据 ID 获取焕新方案详情
  findOne(id: number) {
    return this.renewalPlanRepo.findOne(id)
  }

  // 根据 ID 更新焕新方案，并返回方案 ID
  async update(id: number, updateRenewalPlanDto: UpdateRenewalPlanDto) {
    const plan = await this.renewalPlanRepo.update(id, updateRenewalPlanDto)

    return { planId: plan.id }
  }

  // 根据 ID 删除焕新方案
  remove(id: number) {
    return this.renewalPlanRepo.remove(id)
  }
}
