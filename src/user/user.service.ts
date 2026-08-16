import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WxPhoneLoginDto } from './dto/wx-phone-login.dto';
import { UserRepository } from './user.repository';
import { WxUtil } from 'src/utils/wx.util';
import { JwtService } from '@nestjs/jwt';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly wxUtil: WxUtil,
    private userRepo: UserRepository,
  ) { }

  // 前端微信登录
  async wxPhoneLogin(dto: WxPhoneLoginDto) {
    const { code, phoneCode } = dto

    // 1️.获取 openid
    const { openid, session_key } = await this.wxUtil.getSession(code)

    // 2️.解密手机号
    const mobile = await this.wxUtil.getPhoneNumber(phoneCode)

    // 3️.查当前用户
    let user = await this.userRepo.findUser(openid, mobile)

    // 4.用户不存在 → 创建
    if (!user) {
      user = await this.userRepo.createUser({
        openid,
        mobile,
      })
    }

    if (!user.status) {
      throw new ForbiddenException('账号已被禁用')
    }

    // 5.生成 token（带角色）
    const token = this.jwtService.sign({
      userId: user.id,
      role: user.role,
      type: 'user',
    })

    return {
      token,
      user,
    }
  }

  // 获取用户列表
  async findAll(query: QueryUserDto) {
    const [list, total] = await this.userRepo.findAll(query)

    return {
      list,
      total,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      totalPage: Math.ceil(total / query.pageSize),
    }
  }

  // 获取用户详情
  async findOne(id: number) {
    const user = await this.userRepo.findOne(id)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user
  }

  // 更新用户信息
  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id)

    if (updateUserDto.mobile) {
      const mobileOwner = await this.userRepo.findByMobile(updateUserDto.mobile)
      if (mobileOwner && mobileOwner.id !== id) {
        throw new BadRequestException('手机号码已被其他用户使用')
      }
    }

    try {
      return await this.userRepo.update(id, updateUserDto)
    } catch {
      throw new BadRequestException('用户更新失败')
    }
  }

  // 逻辑删除用户
  async remove(id: number) {
    await this.findOne(id)
    try {
      return await this.userRepo.disable(id)
    } catch {
      throw new BadRequestException('用户删除失败')
    }
  }
}
