// 文件说明：续费方案数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateRenewalPlanDto } from './dto/create-renewal-plan.dto'
import { UpdateRenewalPlanDto } from './dto/update-renewal-plan.dto'

@Injectable()
export class RenewalPlanRepository {
  constructor(private prisma: PrismaService) {}

  // 新增焕新方案
  create(createRenewalPlanDto: CreateRenewalPlanDto) {
    const { items, ...planData } = createRenewalPlanDto

    return this.prisma.renewalPlan.create({
      data: {
        ...planData,
        items: {
          create: items,
        },
      },
    })
  }

  // 获取全部焕新方案
  findAll() {
    return this.prisma.renewalPlan.findMany({
      include: {
        items: {
          include: { product: true },
          orderBy: { sort: 'asc' },
        },
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    })
  }

  // 获取焕新方案详情
  findOne(id: number) {
    return this.prisma.renewalPlan.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
          orderBy: { sort: 'asc' },
        },
      },
    })
  }

  // 更新焕新方案
  update(id: number, updateRenewalPlanDto: UpdateRenewalPlanDto) {
    const { items, ...planData } = updateRenewalPlanDto

    return this.prisma.renewalPlan.update({
      where: { id },
      data: {
        ...planData,
        ...(items && {
          items: {
            deleteMany: {},
            create: items,
          },
        }),
      },
    })
  }

  // 删除焕新方案
  remove(id: number) {
    return this.prisma.renewalPlan.delete({ where: { id } })
  }
}
