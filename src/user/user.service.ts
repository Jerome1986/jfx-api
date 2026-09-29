// 文件说明：用户业务服务，负责业务规则与流程编排。
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WxPhoneLoginDto } from './dto/wx-phone-login.dto';
import { UserRepository } from './user.repository';
import { WxUtil } from 'src/utils/wx.util';
import { getBeijingMonthRange } from 'src/utils/date.util';
import { JwtService } from '@nestjs/jwt';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TestRole } from './user.controller';
import { QueryScoreDto } from './dto/query-score-dto';
import { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface';

@Injectable()
export class UserService {
  // 注入 JwtService、WxUtil、UserRepository，供当前模块的业务校验与流程编排使用。
  constructor(
    private readonly jwtService: JwtService,
    private readonly wxUtil: WxUtil,
    private userRepo: UserRepository
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

  // 用户数据汇总
  async summary(userId: number) {
    const summary = await this.userRepo.summary(userId)
    if (!summary) {
      throw new NotFoundException('用户不存在')
    }
    return summary
  }

  // 用户积分统计
  async scoreSummary(user: UserJwtPayload) {
    if (user.type !== 'user') throw new ForbiddenException('仅用户可查看自己的积分统计')
    const account = await this.userRepo.findById(user.userId)
    if (!account) throw new NotFoundException('用户不存在')
    if (!account.status) throw new ForbiddenException('账号已被禁用')
    const { start, end } = getBeijingMonthRange()
    const [monthly, earned, used] = await this.userRepo.scoreSummary(user.userId, start, end)
    return {
      // 收入包含取消订单返还积分，支出包含待支付订单占用积分。
      monthlyPointsEarned: monthly._sum.change ?? 0,
      totalPointsEarned: earned._sum.change ?? 0,
      totalPointsUsed: Math.abs(used._sum.change ?? 0),
      points: account.points,
    }
  }

  // 获取用户积分明细
  async scoreFlow(queryDto: QueryScoreDto, user: UserJwtPayload) {
    const pageNum = Number(queryDto.pageNum) || 1
    const pageSize = Number(queryDto.pageSize) || 10
    const type = queryDto.type
    const userId = user.userId

    // 1.查询当前用户账号是否被禁用
    const checkUser = await this.userRepo.findOne(userId)
    if (!checkUser) throw new NotFoundException('用户不存在')
    if (!checkUser.status) throw new ForbiddenException('禁止访问')

    // 2.查询
    const [list, total] = await this.userRepo.scoreFlow(type, userId, pageNum, pageSize)

    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize)
    }
  }

  // 测试登录接口
  async testLogin(role: TestRole) {
    let user: any = {}
    if (role === 'CUSTOMER') {
      user = await this.userRepo.testUser()
    } else if (role === 'EMPLOYEE') {
      user = await this.userRepo.testEmployee()
    }

    // 生成 token（带角色）
    const token = this.jwtService.sign({
      userId: user.id,
      role: user.role,
      type: 'user',
    })

    return {
      token,
      user
    }
  }
}
