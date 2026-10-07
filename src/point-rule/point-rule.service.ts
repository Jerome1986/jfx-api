import { Injectable } from '@nestjs/common'
import type { PointRule } from '../../generated/prisma/client'
import { CreatePointRuleDto } from './dto/create-point-rule.dto'
import { PointRuleRepository } from './point-rule.repository'

@Injectable()
export class PointRuleService {
  constructor(private readonly pointRuleRepository: PointRuleRepository) {}

  async save(dto: CreatePointRuleDto, adminId: number) {
    return this.toResponse(await this.pointRuleRepository.save(dto, adminId))
  }

  async findCurrent() {
    const rule = await this.pointRuleRepository.findCurrent()
    return rule ? this.toResponse(rule) : null
  }

  // 金额统一返回两位小数字符串，避免浮点精度损失。
  private toResponse(rule: PointRule) {
    return {
      ...rule,
      rewardYuan: rule.rewardYuan.toFixed(2),
      deductYuan: rule.deductYuan.toFixed(2),
    }
  }
}
