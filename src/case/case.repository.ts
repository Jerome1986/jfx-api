import { Injectable } from "@nestjs/common";
import { CreateCaseDto } from "./dto/create-case.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { PublishStatus } from "../../generated/prisma/enums";

@Injectable()
export class caseRepository {
  constructor(private prisma: PrismaService) { }

  // 新增案例
  createCase(createCaseDto: CreateCaseDto) {
    const {
      beforeCover,
      afterCover,
      highlights,
      costs,
      tags,
      status,
      ...data
    } = createCaseDto

    const statusMap: Record<CreateCaseDto['status'], PublishStatus> = {
      draft: PublishStatus.DRAFT,
      published: PublishStatus.PUBLISHED,
      offline: PublishStatus.OFFLINE,
    }

    return this.prisma.renovationCase.create({
      data: {
        ...data,
        beforeImage: beforeCover,
        afterImage: afterCover,
        tags,
        highlights: highlights.map(({ title, description }) => ({
          title,
          description,
        })),
        costs: costs.map(({ name, amount }) => ({ name, amount })),
        status: statusMap[status],
      },
    })
  }

  // 获取所有案例（分页）
  async findAllCase(pageNum: number, pageSize: number) {
    return await Promise.all([
      this.prisma.renovationCase.findMany({
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.renovationCase.count()
    ])
  }
}
