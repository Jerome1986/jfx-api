import { legacyProjectOmit } from '../renovation-project/legacy-project-fields';
// 文件说明：员工数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import { QueryEmployeeDto } from './dto/query-employee.dto'
import { UpdateEmployeeDto } from './dto/update-employee.dto'
import { QueryEmployeeProjectDto } from './dto/query-employee-project.dto'
import { CancelProjectDto } from './dto/cancel-project.dto'

import { QueryEmployeePerformanceDto } from './dto/query-employee-performance.dto'

export const employeeProjectDetailInclude = {
  quoteItems: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
  employee: { include: { user: { select: { realName: true } } } },
  plan: true,
} satisfies Prisma.RenovationProjectInclude

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
  // 注入 PrismaService，封装当前模块的数据库访问。
  constructor(private prisma: PrismaService) { }

  // 根据用户 ID 查询员工档案，支持传入事务客户端
  findByUserId(userId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.employee.findUnique({
      where: { userId },
      include: {
        user: { select: { role: true, status: true } },
      },
    })
  }

  // 按当前员工统计预约和装修项目各阶段数量
  async summary(employeeId: number) {
    const [pendingContactCount, pendingVisitCount, pendingConfirmCount, inServiceCount] =
      await Promise.all([
        this.prisma.appointment.count({
          where: { employeeId, status: 'PENDING_CONTACT' },
        }),
        this.prisma.appointment.count({
          where: { employeeId, status: 'PENDING_VISIT' },
        }),
        this.prisma.renovationProject.count({
          where: { employeeId, status: 'PENDING_CONFIRM' },
        }),
        this.prisma.renovationProject.count({
          where: { employeeId, status: 'IN_SERVICE' },
        }),
      ])

    return {
      pendingContactCount,
      pendingVisitCount,
      pendingConfirmCount,
      inServiceCount,
    }
  }

  // 概览与中心统一按已完工项目、完成时间统计合同金额。
  performanceSummary(employeeId: number, start: Date, end: Date) {
    return this.prisma.$transaction(async tx => {
      const signedProjects = await tx.renovationProject.findMany({
        where: {
          employeeId,
          status: 'COMPLETED',
          completedAt: { gte: start, lt: end },
        },
        select: { mobile: true, contractAmount: true },
      })
      const completedGroups = await tx.renovationProject.groupBy({
        by: ['employeeId'],
        where: {
          employeeId: { not: null },
          employee: { is: { status: true, user: { is: { role: 'EMPLOYEE', status: true } } } },
          status: 'COMPLETED',
          completedAt: { gte: start, lt: end },
        },
        _sum: { contractAmount: true },
        _count: { _all: true },
      })
      return { signedProjects, completedGroups }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  }

  // 业绩中心金额、数量、排名和项目列表统一按完工时间统计。
  performanceCenter(employeeId: number, query: QueryEmployeePerformanceDto, range?: { start: Date; end: Date }) {
    const signedWhere: Prisma.RenovationProjectWhereInput = {
      employeeId: { not: null },
      employee: { is: { status: true, user: { is: { role: 'EMPLOYEE', status: true } } } },
      status: 'COMPLETED',
      ...(range ? { completedAt: { gte: range.start, lt: range.end } } : {}),
    }
    const completedWhere: Prisma.RenovationProjectWhereInput = {
      employeeId,
      status: 'COMPLETED',
      ...(range ? { completedAt: { gte: range.start, lt: range.end } } : {}),
    }
    return this.prisma.$transaction(async tx => {
      const groups = await tx.renovationProject.groupBy({
        by: ['employeeId'], where: signedWhere,
        _sum: { contractAmount: true }, _count: { _all: true },
      })
      const employees = await tx.employee.findMany({
        where: { status: true, user: { is: { role: 'EMPLOYEE', status: true } } },
        select: { id: true, user: { select: { realName: true, nickname: true } } },
      })
      const totalSigned = await tx.renovationProject.aggregate({
        where: { employeeId, status: 'COMPLETED' },
        _sum: { contractAmount: true }, _count: { _all: true },
      })
      const completedProjectCount = await tx.renovationProject.count({ where: completedWhere })
      const totalCompletedProjectCount = range
        ? await tx.renovationProject.count({ where: { employeeId, status: 'COMPLETED' } })
        : completedProjectCount
      const projects = await tx.renovationProject.findMany({
        where: completedWhere,
        select: {
          id: true, name: true, customerName: true, mobile: true,
          contractAmount: true, completedAt: true,
          plan: { select: { name: true } },
        },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        skip: (query.pageNum - 1) * query.pageSize, take: query.pageSize,
      })
      return { groups, employees, totalSigned, completedProjectCount, totalCompletedProjectCount, projects }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  }

  // 按员工和订单状态分页查询装修订单及总数
  findProjects(employeeId: number, query: QueryEmployeeProjectDto) {
    const where: Prisma.RenovationProjectWhereInput = {
      employeeId,
      ...(query.status === 'ALL' ? {} : { status: query.status }),
    }
    return Promise.all([
      this.prisma.renovationProject.findMany({
      omit: legacyProjectOmit,
        where,
        include: {
          quoteItems: {
            orderBy: [{ sort: 'asc' }, { id: 'asc' }]
          },
          employee: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.pageNum - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.renovationProject.count({ where }),
    ])
  }

  // 按项目 ID 和负责员工查询装修订单及关联详情
  findProject(id: number, employeeId: number) {
    return this.prisma.renovationProject.findFirst({
      omit: legacyProjectOmit,
      where: { id, employeeId },
      include: employeeProjectDetailInclude,
    })
  }

  // 条件更新与确认、完工竞争同一项目，保留所有报价及来源数据。
  cancelProject(id: number, employeeId: number, dto: CancelProjectDto) {
    return this.prisma.renovationProject.update({
      omit: legacyProjectOmit,
      where: { id, employeeId, status: dto.expectedStatus },
      data: {
        status: 'CANCELED', cancelReason: dto.reason.trim(),
        canceledAt: new Date(), canceledByEmployeeId: employeeId,
        progress: dto.reason.trim(),
        progresses: { create: { status: 'CANCELED', content: dto.reason.trim(), createdBy: `employee:${employeeId}` } },
      },
      include: employeeProjectDetailInclude,
    })
  }

  // 将员工负责的服务中项目标记为已完成并记录完成时间
  completeProject(id: number, employeeId: number) {
    return this.prisma.renovationProject.update({
      omit: legacyProjectOmit,
      where: { id, employeeId, status: 'IN_SERVICE' },
      data: { status: 'COMPLETED', completedAt: new Date(), progress: '员工已确认项目完工', progresses: { create: { status: 'COMPLETED', content: '员工已确认项目完工', createdBy: `employee:${employeeId}` } } },
    })
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
