import { Injectable } from "@nestjs/common";
import { CreateCaseDto } from "./dto/create-case.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdateCaseDto } from "./dto/update-case.dto";
import { PublishStatus } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { SearchCaseQueryDto } from "./dto/search-case-query.dto";

@Injectable()
export class caseRepository {
  constructor(private prisma: PrismaService) { }

  // 新增案例
  createCase(createCaseDto: CreateCaseDto) {
    const {
      highlights,
      costs,
      tags,
      status,
      ...data
    } = createCaseDto

    return this.prisma.renovationCase.create({
      data: {
        ...data,
        tags,
        highlights: highlights.map(({ title, description }) => ({
          title,
          description,
        })),
        costs: costs.map(({ name, amount }) => ({ name, amount })),
        status,
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

  // 搜索案例（分页）
  searchCase(query: SearchCaseQueryDto) {
    const {
      title,
      categoryId,
      city,
      status,
      isRecommended,
      pageNum,
      pageSize,
    } = query

    const where: Prisma.RenovationCaseWhereInput = {
      title: { contains: title },
      categoryId,
      city,
      status,
      isRecommended,
    }

    return Promise.all([
      this.prisma.renovationCase.findMany({
        where,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.renovationCase.count({ where }),
    ])
  }

  // 更新案例
  updateCase(id: number, updateCaseDto: UpdateCaseDto) {
    const { categoryId, status, highlights, costs, ...data } = updateCaseDto
    return this.prisma.renovationCase.update({
      where: { id },
      data: {
        categoryId,
        highlights: highlights?.map(({ title, description }) => ({
          title,
          description,
        })),
        costs: costs?.map(({ name, amount }) => ({ name, amount })),
        status,
        ...data
      }
    })
  }

  // 更新案例状态
  changeStauts(id: number, status: PublishStatus) {
    return this.prisma.renovationCase.update({
      where: { id },
      data: {
        status
      }
    })
  }

  // 首页推荐
  isRecommendedByHome(id: number, isRecommended: boolean) {
    return this.prisma.renovationCase.update({
      where: { id },
      data: {
        isRecommended
      }
    })
  }

  // 案例详情
  findOne(id: number) {
    return this.prisma.renovationCase.findUnique({ where: { id } })
  }

  // 删除案例
  remove(id: number) {
    return this.prisma.renovationCase.delete({ where: { id } })
  }
}
