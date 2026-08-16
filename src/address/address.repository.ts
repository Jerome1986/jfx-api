import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateAddressDto } from './dto/create-address.dto'
import { UpdateAddressDto } from './dto/update-address.dto'

@Injectable()
export class AddressRepository {
  constructor(private prisma: PrismaService) {}

  // 新增地址记录
  create(data: CreateAddressDto) {
    return this.prisma.address.create({ data })
  }

  // 查询地址记录列表
  findAll() {
    return this.prisma.address.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  // 根据 ID 查询地址记录
  findOne(id: number) {
    return this.prisma.address.findUnique({ where: { id } })
  }

  // 根据 ID 更新地址记录
  update(id: number, data: UpdateAddressDto) {
    return this.prisma.address.update({
      where: { id },
      data,
    })
  }

  // 根据 ID 删除地址记录
  remove(id: number) {
    return this.prisma.address.delete({ where: { id } })
  }
}
