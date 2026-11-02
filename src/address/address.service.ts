// 文件说明：地址业务服务，负责业务规则与流程编排。
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { AddressRepository } from './address.repository'
import { CreateAddressDto } from './dto/create-address.dto'
import { UpdateAddressDto } from './dto/update-address.dto'
export type AddressActor = { userId: number; type: string; role?: string }

@Injectable()
export class AddressService {
  // 注入 AddressRepository，供当前模块的业务校验与流程编排使用。
  constructor(private readonly addressRepo: AddressRepository) {}

  // 创建地址
  async create(createAddressDto: CreateAddressDto, user: AddressActor) {
    await this.checkUser(user)
    if (user.type !== 'admin') this.checkOwnershipField(createAddressDto)
    const ownerId = user.type === 'admin' ? createAddressDto.userId : user.userId
    if (!Number.isInteger(ownerId) || ownerId! <= 0) throw new BadRequestException('请选择地址所属用户')
    if (!(await this.addressRepo.findUser(ownerId!))) throw new BadRequestException('所属用户不存在')
    try {
      return await this.addressRepo.create({ ...createAddressDto, userId: ownerId! })
    } catch {
      throw new BadRequestException('地址创建失败，请确认用户是否存在')
    }
  }

  async findAll(user: AddressActor) {
    await this.checkUser(user)
    return this.addressRepo.findAll(user.type === 'admin' ? undefined : user.userId)
  }

  // 根据 ID 查询地址
  async findOne(id: number, user: AddressActor) {
    await this.checkUser(user)
    const address = await this.addressRepo.findOne(id, user.type === 'admin' ? undefined : user.userId)
    if (!address) {
      throw new NotFoundException('地址不存在')
    }
    return address
  }

  // 根据 ID 更新地址
  async update(id: number, updateAddressDto: UpdateAddressDto, user: AddressActor) {
    await this.checkUser(user)
    this.checkOwnershipField(updateAddressDto)
    try {
      return await this.addressRepo.update(id, user.type === 'admin' ? undefined : user.userId, updateAddressDto)
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('地址不存在')
      }
      throw new BadRequestException('地址更新失败，请确认用户是否存在')
    }
  }

  // 根据 ID 删除地址
  async remove(id: number, user: AddressActor) {
    await this.checkUser(user)
    try {
      return await this.addressRepo.remove(id, user.type === 'admin' ? undefined : user.userId)
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('地址不存在')
      }
      throw new BadRequestException('地址删除失败')
    }
  }

  private async checkUser(user: AddressActor) {
    if (user.type === 'admin') {
      const admin = await this.addressRepo.findAdmin(user.userId)
      if (!admin?.status) throw new ForbiddenException('管理员账号不存在或已禁用')
      return
    }
    if (user.type !== 'user' || !['CUSTOMER', 'EMPLOYEE'].includes(user.role ?? '')) {
      throw new ForbiddenException('当前账号无权访问用户地址')
    }
    const account = await this.addressRepo.findUser(user.userId)
    if (!account?.status) throw new ForbiddenException('用户账号不存在或已禁用')
  }

  private checkOwnershipField(dto: CreateAddressDto | UpdateAddressDto) {
    if (dto.userId !== undefined || 'user' in dto) {
      throw new BadRequestException('不允许指定或修改地址所属用户')
    }
  }
}
