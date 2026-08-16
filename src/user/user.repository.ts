import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { generateRandomCode } from 'src/utils/random.util'
import { Prisma } from '../../generated/prisma/client'
import { QueryUserDto } from './dto/query-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

const safeUserSelect = {
  id: true,
  userNo: true,
  role: true,
  mobile: true,
  openid: true,
  nickname: true,
  realName: true,
  gender: true,
  avatar: true,
  source: true,
  city: true,
  tags: true,
  points: true,
  totalPointsEarned: true,
  totalPointsUsed: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

@Injectable()
export class UserRepository {
  constructor(private prisma: PrismaService) { }

  // 根据用户 ID 查询用户，支持传入事务客户端
  findById(id: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.user.findUnique({
      where: { id },
      select: safeUserSelect,
    })
  }

  // 将用户身份修改为员工，支持传入事务客户端
  updateRoleToEmployee(id: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.user.update({
      where: { id },
      data: { role: 'EMPLOYEE' },
      select: safeUserSelect,
    })
  }

  // 将用户身份恢复为普通用户，支持传入事务客户端
  updateRoleToCustomer(id: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.user.update({
      where: { id },
      data: { role: 'CUSTOMER' },
      select: safeUserSelect,
    })
  }

  // 注册员工用户，支持传入事务客户端
  createEmployeeUser(
    data: {
      id: number
      mobile: string
      nickname?: string
      realName?: string
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma
    return db.user.create({
      data: {
        ...data,
        userNo: generateRandomCode(),
        role: 'EMPLOYEE',
        avatar: process.env.DEFAULT_AVATAR,
      },
      select: safeUserSelect,
    })
  }

  // 根据 OpenID 或手机号查询登录用户
  findUser(openid: string, mobile: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ openid }, { mobile }],
      },
      select: safeUserSelect,
    })
  }

  // 分页查询后台用户列表
  findAll(query: QueryUserDto) {
    const { pageNum, pageSize, keyword, role, status } = query
    const normalizedKeyword = keyword?.trim()
    const where: Prisma.UserWhereInput = {
      role,
      status,
      ...(normalizedKeyword
        ? {
            OR: [
              { userNo: { contains: normalizedKeyword } },
              { mobile: { contains: normalizedKeyword } },
              { nickname: { contains: normalizedKeyword } },
              { realName: { contains: normalizedKeyword } },
            ],
          }
        : {}),
    }

    return Promise.all([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ])
  }

  // 根据 ID 查询用户详情
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        _count: {
          select: {
            appointments: true,
            favorites: true,
            userCoupons: true,
          },
        },
      },
    })

    if (!user) return null

    const { _count, ...userInfo } = user
    return {
      ...userInfo,
      appointmentCount: _count.appointments,
      favoriteCount: _count.favorites,
      couponCount: _count.userCoupons,
    }
  }

  // 根据手机号查询用户
  findByMobile(mobile: string) {
    return this.prisma.user.findUnique({ where: { mobile }, select: { id: true } })
  }


  // 创建微信登录用户
  createUser(data: {
    openid: string
    mobile: string
  }) {
    return this.prisma.user.create({
      data: {
        userNo: generateRandomCode(),
        openid: data.openid,
        mobile: data.mobile,
        nickname: '微信用户',
        avatar: process.env.DEFAULT_AVATAR,
      },
      select: safeUserSelect,
    })
  }


  // 根据 ID 更新用户信息
  update(id: number, data: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: safeUserSelect,
    })
  }

  // 根据 ID 禁用用户
  disable(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: { status: false },
      select: safeUserSelect,
    })
  }
}
