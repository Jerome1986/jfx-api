// 文件说明：地址业务服务，负责业务规则与流程编排。
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AddressRepository } from './address.repository'
import { CreateAddressDto } from './dto/create-address.dto'
import { UpdateAddressDto } from './dto/update-address.dto'

@Injectable()
export class AddressService {
  constructor(private readonly addressRepo: AddressRepository) {}

  // 创建地址
  async create(createAddressDto: CreateAddressDto) {
    try {
      return await this.addressRepo.create(createAddressDto)
    } catch {
      throw new BadRequestException('地址创建失败，请确认用户是否存在')
    }
  }

  // 查询全部地址
  findAll() {
    return this.addressRepo.findAll()
  }

  // 根据 ID 查询地址
  async findOne(id: number) {
    const address = await this.addressRepo.findOne(id)
    if (!address) {
      throw new NotFoundException('地址不存在')
    }
    return address
  }

  // 根据 ID 更新地址
  async update(id: number, updateAddressDto: UpdateAddressDto) {
    await this.findOne(id)
    try {
      return await this.addressRepo.update(id, updateAddressDto)
    } catch {
      throw new BadRequestException('地址更新失败，请确认用户是否存在')
    }
  }

  // 根据 ID 删除地址
  async remove(id: number) {
    await this.findOne(id)
    try {
      return await this.addressRepo.remove(id)
    } catch {
      throw new BadRequestException('地址删除失败')
    }
  }
}
