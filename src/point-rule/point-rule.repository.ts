import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePointRuleDto } from './dto/create-point-rule.dto'

@Injectable()
export class PointRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCurrent() {
    return this.prisma.pointRule.findUnique({ where: { id: 1 } })
  }

  async save(dto: CreatePointRuleDto, adminId: number) {
    const data = {
      rewardEnabled: dto.rewardEnabled,
      rewardYuan: dto.rewardYuan,
      rewardPoints: dto.rewardPoints,
      deductEnabled: dto.deductEnabled,
      deductPoints: dto.deductPoints,
      deductYuan: dto.deductYuan,
      limit: dto.limit,
      updatedById: adminId,
    }
    const update = { ...data, version: { increment: 1 } }
    try {
      return await this.prisma.pointRule.upsert({
        where: { id: 1 },
        create: { ...data, id: 1, version: 1 },
        update,
      })
    } catch (error) {
      // MySQL 并发首次保存可能发生主键冲突，转为更新并原子递增版本。
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.pointRule.update({ where: { id: 1 }, data: update })
      }
      throw error
    }
  }
}
