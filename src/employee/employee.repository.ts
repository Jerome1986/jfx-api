// 文件说明：员工数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import { QueryEmployeeDto } from './dto/query-employee.dto'
import { UpdateEmployeeDto } from './dto/update-employee.dto'

// 员工接口允许返回的关联用户字段，避免泄露密码等敏感信息
export const safeEmployeeInclude = {
  user: {
    select: {
      id: true,
      userNo: true,
      role: true,
      mobile: true,
      nickname: true,
      realName: true,
      gender: true,
      avatar: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.EmployeeInclude

@Injectable()
export class EmployeeRepository {
  constructor(private prisma: PrismaService) { }

  // 根据用户 ID 查询员工档案，支持传入事务客户端
  findByUserId(userId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.employee.findUnique({ where: { userId } })
  }

  // 创建员工档案，支持传入事务客户端
  create(data: Prisma.EmployeeUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.employee.create({
      data,
      include: safeEmployeeInclude,
    })
  }

  // 根据分页参数和筛选条件查询员工列表及总数
  findAll(query: QueryEmployeeDto) {
    // 1. 整理分页参数和搜索条件
    const { pageNum, pageSize, keyword, department, status } = query
    const normalizedKeyword = keyword?.trim()
    const where: Prisma.EmployeeWhereInput = {
      department,
      status,
      ...(normalizedKeyword
        ? {
            OR: [
              { employeeNo: { contains: normalizedKeyword } },
              { position: { contains: normalizedKeyword } },
              { user: { is: { realName: { contains: normalizedKeyword } } } },
              { user: { is: { mobile: { contains: normalizedKeyword } } } },
            ],
          }
        : {}),
    }

    // 2. 并行查询员工列表和记录总数
    return Promise.all([
      this.prisma.employee.findMany({
        where,
        include: safeEmployeeInclude,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ])
  }

  // 根据主键查询单个员工及其关联用户信息
  findOne(id: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.employee.findUnique({
      where: { id },
      include: safeEmployeeInclude,
    })
  }

  // 根据主键更新员工档案
  update(id: number, data: UpdateEmployeeDto) {
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...data,
        hiredAt: data.hiredAt ? new Date(data.hiredAt) : undefined,
      },
      include: safeEmployeeInclude,
    })
  }

  // 根据主键删除员工档案
  remove(id: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.employee.delete({ where: { id } })
  }
}
