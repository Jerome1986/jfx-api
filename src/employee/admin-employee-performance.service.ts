import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { getBeijingMonthRange } from '../utils/date.util'
import { AdminEmployeePerformanceRepository } from './admin-employee-performance.repository'
import { QueryAdminEmployeePerformanceDto } from './dto/query-admin-employee-performance.dto'
import type { AdminEmployeePerformanceResult } from './interfaces/admin-employee-performance.interface'

@Injectable()
export class AdminEmployeePerformanceService {
  constructor(private readonly repo: AdminEmployeePerformanceRepository) {}

  // 先计算全公司排名，再筛选和分页，避免筛选改变员工名次。
  async list(query: QueryAdminEmployeePerformanceDto): Promise<AdminEmployeePerformanceResult> {
    const currentRange = getBeijingMonthRange()
    const month = query.month ?? new Date(currentRange.start.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7)
    const range = month === 'all' ? undefined : getBeijingMonthRange(new Date(month + '-15T00:00:00+08:00'))
    const { pageNum, pageSize } = query
    return this.repo.withSnapshot(async tx => {
      const employees = await this.repo.findEmployees(tx)
      const groups = await this.repo.aggregateCompleted(tx, range)
      const grouped = new Map(groups.map(group => [group.employeeId, group]))
      const rows = employees.map(employee => {
        const group = grouped.get(employee.id)
        return {
          employee,
          amount: group?._sum.contractAmount ?? new Prisma.Decimal(0),
          count: group?._count._all ?? 0,
          isActive: employee.status && employee.user.status && employee.user.role === 'EMPLOYEE',
        }
      }).sort((a, b) => b.amount.comparedTo(a.amount) || a.employee.id - b.employee.id)

      const ranks = new Map<number, number>()
      let previous: Prisma.Decimal | undefined
      let rank = 0
      rows.filter(row => row.isActive).forEach((row, index) => {
        if (!previous || !row.amount.equals(previous)) rank = index + 1
        ranks.set(row.employee.id, rank)
        previous = row.amount
      })
      const keyword = query.keyword?.trim().toLocaleLowerCase()
      const filtered = rows.filter(({ employee }) =>
        (query.status === undefined || employee.status === query.status) &&
        (query.department === undefined || employee.department === query.department) &&
        (!keyword || [employee.employeeNo, employee.position, employee.user.realName, employee.user.mobile]
          .some(value => value?.toLocaleLowerCase().includes(keyword))),
      )
      const page = filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize)
      const customers = new Map<number, Set<string>>()
      if (page.length) {
        const customerGroups = await this.repo.findCustomerGroups(tx, page.map(row => row.employee.id), range)
        for (const group of customerGroups) {
          const mobile = group.mobile.trim()
          if (group.employeeId === null || !mobile) continue
          const phones = customers.get(group.employeeId) ?? new Set<string>()
          phones.add(mobile)
          customers.set(group.employeeId, phones)
        }
      }
      return {
        month,
        list: page.map(({ employee, amount, count, isActive }) => ({
          employeeId: employee.id, employeeNo: employee.employeeNo,
          name: employee.user.realName || employee.user.nickname || '员工', mobile: employee.user.mobile,
          department: employee.department, position: employee.position, status: employee.status, isActive,
          signedCustomerCount: customers.get(employee.id)?.size ?? 0,
          signedAmount: amount.toFixed(2), completedProjectCount: count,
          averageSignedAmount: count ? amount.div(count).toFixed(2) : '0.00',
          companyRank: ranks.get(employee.id) ?? null,
        })),
        total: filtered.length, pageNum, pageSize, totalPage: Math.ceil(filtered.length / pageSize),
      }
    })
  }
}
