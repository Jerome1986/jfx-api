import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { QueryServiceCityDto } from './dto/query-service-city.dto'

interface ServiceCityWriteData {
  name?: string
  code?: string
  sort?: number
  status?: boolean
}

@Injectable()
export class ServiceCityRepository {
  constructor(private readonly prisma: PrismaService) {}

  // 写入一条服务城市记录。
  create(data: Required<Pick<ServiceCityWriteData, 'name' | 'code'>> & ServiceCityWriteData) {
    return this.prisma.serviceCity.create({ data })
  }

  // 按筛选条件分页查询城市列表和总数。
  findAll(query: QueryServiceCityDto) {
    const keyword = query.keyword?.trim()
    const where: Prisma.ServiceCityWhereInput = {
      status: query.status,
      ...(keyword ? { name: { contains: keyword } } : {}),
    }

    return Promise.all([
      this.prisma.serviceCity.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (query.pageNum - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.serviceCity.count({ where }),
    ])
  }

  // 查询全部启用城市并按排序值和名称排序。
  findEnabled() {
    return this.prisma.serviceCity.findMany({
      where: { status: true },
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
    })
  }

  // 根据主键 ID 查询单个城市。
  findOne(id: number) {
    return this.prisma.serviceCity.findUnique({ where: { id } })
  }

  // 查询是否存在名称或 CODE 冲突的其他城市。
  findConflict(name: string, code: string, excludeId?: number) {
    return this.prisma.serviceCity.findFirst({
      where: {
        OR: [{ name }, { code }],
        ...(excludeId === undefined ? {} : { NOT: { id: excludeId } }),
      },
    })
  }

  // 根据主键 ID 更新城市记录。
  update(id: number, data: ServiceCityWriteData) {
    return this.prisma.serviceCity.update({ where: { id }, data })
  }

  // 在事务中更新城市并同步所有关联服务网点的城市名称。
  updateWithOutletNames(id: number, data: ServiceCityWriteData & { name: string }) {
    return this.prisma.$transaction(async (tx) => {
      const city = await tx.serviceCity.update({ where: { id }, data })
      await tx.serviceOutlet.updateMany({
        where: { cityId: id },
        data: { cityName: data.name },
      })
      return city
    })
  }

  // 统计指定城市关联的服务网点数量。
  countOutlets(id: number) {
    return this.prisma.serviceOutlet.count({ where: { cityId: id } })
  }

  // 根据主键 ID 物理删除城市记录。
  remove(id: number) {
    return this.prisma.serviceCity.delete({ where: { id } })
  }
}
