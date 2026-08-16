import { Injectable } from '@nestjs/common'
import { CreateRenewalPlanDto } from './dto/create-renewal-plan.dto'
import { RenewalPlanRepository } from './renewal-plan.repository'
import { UpdateRenewalPlanDto } from './dto/update-renewal-plan.dto'

@Injectable()
export class RenewalPlanService {
  constructor(private renewalPlanRepo: RenewalPlanRepository) {}

  async create(createRenewalPlanDto: CreateRenewalPlanDto) {
    const plan = await this.renewalPlanRepo.create(createRenewalPlanDto)

    return { planId: plan.id }
  }

  findAll() {
    return this.renewalPlanRepo.findAll()
  }

  findOne(id: number) {
    return this.renewalPlanRepo.findOne(id)
  }

  async update(id: number, updateRenewalPlanDto: UpdateRenewalPlanDto) {
    const plan = await this.renewalPlanRepo.update(id, updateRenewalPlanDto)

    return { planId: plan.id }
  }

  remove(id: number) {
    return this.renewalPlanRepo.remove(id)
  }
}
