import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateConstructionServiceDto } from './dto/create-construction-service.dto'
import { QueryConstructionServiceDto } from './dto/query-construction-service.dto'
import { UpdateConstructionServiceDto } from './dto/update-construction-service.dto'

@Injectable()
export class ConstructionServiceRepository {
  constructor(private prisma: PrismaService) {}

  // 新增施工服务
  create(data: CreateConstructionServiceDto) {
    return this.prisma.constructionService.create({ data })
  }

  // 分页查询施工服务列表及总数
  findAll(query: QueryConstructionServiceDto) {
    // 1. 整理分页参数和筛选条件
    const { pageNum, pageSize, keyword, isEnabled } = query
    const normalizedKeyword = keyword?.trim()
    const where: Prisma.ConstructionServiceWhereInput = {
      isEnabled,
      ...(normalizedKeyword
        ? {
            OR: [
              { name: { contains: normalizedKeyword } },
              { description: { contains: normalizedKeyword } },
            ],
          }
        : {}),
    }

    // 2. 并行查询当前页数据和总记录数
    return Promise.all([
      this.prisma.constructionService.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.constructionService.count({ where }),
    ])
  }

  // 根据 ID 查询施工服务详情
  findOne(id: number) {
    return this.prisma.constructionService.findUnique({ where: { id } })
  }

  // 根据 ID 更新施工服务
  update(id: number, data: UpdateConstructionServiceDto) {
    return this.prisma.constructionService.update({
      where: { id },
      data,
    })
  }

  // 逻辑停用施工服务
  disable(id: number) {
    return this.prisma.constructionService.update({
      where: { id },
      data: { isEnabled: false },
    })
  }
}
