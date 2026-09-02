// 文件说明：服务网点数据仓储，负责封装 Prisma 数据库访问操作。
import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateServiceOutletDto } from './dto/create-service-outlet.dto'
import { QueryServiceOutletDto } from './dto/query-service-outlet.dto'
import { UpdateServiceOutletDto } from './dto/update-service-outlet.dto'

type ServiceOutletCreateData = Omit<CreateServiceOutletDto, 'cityId'> & {
  cityId: number
  cityName: string
}

type ServiceOutletUpdateData = Omit<UpdateServiceOutletDto, 'cityId'> & {
  cityId?: number
  cityName?: string
}

@Injectable()
export class ServiceOutletRepository {
  constructor(private prisma: PrismaService) { }

  // 写入一条服务网点记录
  create(data: ServiceOutletCreateData) {
    return this.prisma.serviceOutlet.create({
      data,
      include: { serviceCity: true },
    })
  }

  // 按条件分页查询服务网点列表及符合条件的总记录数
  findAll(query: QueryServiceOutletDto) {
    const { pageNum, pageSize, keyword, cityId, district, status } = query
    const normalizedKeyword = keyword?.trim()
    const where: Prisma.ServiceOutletWhereInput = {
      cityId,
      district,
      status,
      ...(normalizedKeyword
        ? {
          OR: [
            { name: { contains: normalizedKeyword } },
            { address: { contains: normalizedKeyword } },
            { phone: { contains: normalizedKeyword } },
          ],
        }
        : {}),
    }

    return Promise.all([
      this.prisma.serviceOutlet.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        include: { serviceCity: true },
      }),
      this.prisma.serviceOutlet.count({ where }),
    ])
  }

  // 小程序端按城市 ID 查询已启用的服务网点
  findByCity(cityId: number) {
    return this.prisma.serviceOutlet.findMany({
      where: {
        cityId,
        status: true,
        serviceCity: { is: { status: true } },
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      include: { serviceCity: true },
    })
  }

  // 根据主键 ID 查询单个服务网点
  findOne(id: number) {
    return this.prisma.serviceOutlet.findUnique({
      where: { id },
      include: { serviceCity: true },
    })
  }

  // 根据主键 ID 查询可用的服务城市。
  findEnabledCity(id: number) {
    return this.prisma.serviceCity.findFirst({ where: { id, status: true } })
  }

  // 根据主键 ID 更新服务网点记录
  update(id: number, data: ServiceOutletUpdateData) {
    return this.prisma.serviceOutlet.update({
      where: { id },
      data,
      include: { serviceCity: true },
    })
  }

  // 根据主键 ID 物理删除服务网点记录
  remove(id: number) {
    return this.prisma.serviceOutlet.delete({ where: { id } })
  }
}
