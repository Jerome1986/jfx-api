import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type MonthRange = { start: Date; end: Date }

@Injectable()
export class AdminEmployeePerformanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // 员工、业绩聚合、当页客户去重使用同一个只读快照。
  withSnapshot<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  }

  findEmployees(tx: Prisma.TransactionClient) {
    return tx.employee.findMany({
      select: {
        id: true, employeeNo: true, department: true, position: true, status: true,
        user: { select: { realName: true, nickname: true, mobile: true, role: true, status: true } },
      },
    })
  }

  // 累计不限制完成时间，保留缺少完成时间的历史完工项目。
  private completedWhere(range?: MonthRange): Prisma.RenovationProjectWhereInput {
    return {
      status: 'COMPLETED', employeeId: { not: null },
      ...(range ? { completedAt: { gte: range.start, lt: range.end } } : {}),
    }
  }

  aggregateCompleted(tx: Prisma.TransactionClient, range?: MonthRange) {
    return tx.renovationProject.groupBy({
      by: ['employeeId'], where: this.completedWhere(range),
      _sum: { contractAmount: true }, _count: { _all: true },
    })
  }

  findCustomerGroups(tx: Prisma.TransactionClient, employeeIds: number[], range?: MonthRange) {
    return tx.renovationProject.groupBy({
      by: ['employeeId', 'mobile'],
      where: { ...this.completedWhere(range), employeeId: { in: employeeIds } },
    })
  }
}
