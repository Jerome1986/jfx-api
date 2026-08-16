import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateRenewalPlanDto } from './dto/create-renewal-plan.dto'
import { UpdateRenewalPlanDto } from './dto/update-renewal-plan.dto'

@Injectable()
export class RenewalPlanRepository {
  constructor(private prisma: PrismaService) {}

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

  remove(id: number) {
    return this.prisma.renewalPlan.delete({ where: { id } })
  }
}
