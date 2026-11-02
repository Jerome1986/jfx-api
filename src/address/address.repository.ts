// 文件说明：地址数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateAddressDto } from './dto/create-address.dto'
import { UpdateAddressDto } from './dto/update-address.dto'

@Injectable()
export class AddressRepository {
  // 注入 PrismaService，封装当前模块的数据库访问。
  constructor(private prisma: PrismaService) {}

  // 新增地址记录
  create(data: CreateAddressDto & { userId: number }) {
    return this.prisma.address.create({ data })
  }

  // 查询地址记录列表
  findAll(userId?: number) {
    return this.prisma.address.findMany({
      where: userId === undefined ? {} : { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // 根据 ID 查询地址记录
  findOne(id: number, userId?: number) {
    return this.prisma.address.findUnique({ where: { id, ...(userId === undefined ? {} : { userId }) } })
  }

  // 根据 ID 更新地址记录
  update(id: number, userId: number | undefined, data: UpdateAddressDto) {
    return this.prisma.address.update({
      where: { id, ...(userId === undefined ? {} : { userId }) },
      data,
    })
  }

  // 根据 ID 删除地址记录
  remove(id: number, userId?: number) {
    return this.prisma.address.delete({ where: { id, ...(userId === undefined ? {} : { userId }) } })
  }

  // 查询当前用户账号状态，避免后台账号与用户 ID 重合时越权。
  findAdmin(id: number) {
    return this.prisma.admin.findUnique({ where: { id }, select: { status: true } })
  }

  findUser(id: number) {
    return this.prisma.user.findUnique({ where: { id }, select: { status: true } })
  }
}

