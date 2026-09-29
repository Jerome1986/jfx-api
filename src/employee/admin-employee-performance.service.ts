import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { getBeijingMonthRange } from '../utils/date.util'
import { AdminEmployeePerformanceRepository } from './admin-employee-performance.repository'
import { QueryAdminEmployeePerformanceDto } from './dto/query-admin-employee-performance.dto'
import type { AdminEmployeePerformanceResult } from './interfaces/admin-employee-performance.interface'

@Injectable()
export class AdminEmployeePerformanceService {
  // 注入 AdminEmployeePerformanceRepository，供当前模块的业务校验与流程编排使用。
  constructor(private readonly repo: AdminEmployeePerformanceRepository) {}

  // 后台员工业绩：先计算公司排名，再按条件筛选和分页。
  async list(query: QueryAdminEmployeePerformanceDto): Promise<AdminEmployeePerformanceResult> {
    // 1. 确定统计月份：默认北京时间本月，all 表示累计，不限制完成时间。
    const { pageNum, pageSize, department, status } = query
    const keyword = query.keyword?.trim().toLocaleLowerCase()
    const currentRange = getBeijingMonthRange()
    const currentMonth = new Date(currentRange.start.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7)
    const month = query.month ?? currentMonth
    const range = month === 'all' ? undefined : getBeijingMonthRange(new Date(month + '-15T00:00:00+08:00'))

    // 2. 在同一事务快照中读取员工、完工业绩及客户数，保证数据一致。
    return this.repo.withSnapshot(async tx => {
      const employees = await this.repo.findEmployees(tx)
      const groups = await this.repo.aggregateCompleted(tx, range)
      const performanceByEmployee = new Map(groups.map(group => [group.employeeId, group]))

      // 3. 合并员工业绩，无业绩补零；按金额降序、员工 ID 升序排列。
      const rows = employees.map(employee => {
        const performance = performanceByEmployee.get(employee.id)
        return {
          employee,
          amount: performance?._sum.contractAmount ?? new Prisma.Decimal(0),
          count: performance?._count._all ?? 0,
          isActive: employee.status && employee.user.status && employee.user.role === 'EMPLOYEE',
          companyRank: null as number | null,
        }
      })
      rows.sort((a, b) => b.amount.comparedTo(a.amount) || a.employee.id - b.employee.id)

      // 4. 只有有效员工参与公司排名，同额沿用前一名的名次，如 1、1、3。
      const activeRows = rows.filter(row => row.isActive)
      activeRows.forEach((row, index) => {
        const previous = activeRows[index - 1]
        row.companyRank = previous && row.amount.equals(previous.amount)
          ? previous.companyRank
          : index + 1
      })

      // 5. 排名完成后再筛选、分页，部门和关键词不会改变公司名次。
      const filtered = rows.filter(({ employee }) => {
        if (status !== undefined && employee.status !== status) return false
        if (department !== undefined && employee.department !== department) return false
        if (!keyword) return true
        const fields = [employee.employeeNo, employee.position, employee.user.realName, employee.user.mobile]
        return fields.some(value => value?.toLocaleLowerCase().includes(keyword))
      })
      const total = filtered.length
      const page = filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize)

      // 6. 仅查询当页员工的客户手机号，去除首尾空白、空号码并按员工去重。
      const customers = new Map<number, Set<string>>()
      if (page.length) {
        const employeeIds = page.map(row => row.employee.id)
        const customerGroups = await this.repo.findCustomerGroups(tx, employeeIds, range)
        for (const { employeeId, mobile } of customerGroups) {
          const phone = mobile.trim()
          if (employeeId === null || !phone) continue
          const phones = customers.get(employeeId) ?? new Set<string>()
          phones.add(phone)
          customers.set(employeeId, phones)
        }
      }

      // 7. 组装列表和分页信息，Decimal 金额统一输出两位小数字符串。
      const list = page.map(({ employee, amount, count, isActive, companyRank }) => ({
        employeeId: employee.id,
        employeeNo: employee.employeeNo,
        name: employee.user.realName || employee.user.nickname || '员工',
        mobile: employee.user.mobile,
        department: employee.department,
        position: employee.position,
        status: employee.status,
        isActive,
        signedCustomerCount: customers.get(employee.id)?.size ?? 0,
        signedAmount: amount.toFixed(2),
        completedProjectCount: count,
        averageSignedAmount: count ? amount.div(count).toFixed(2) : '0.00',
        companyRank,
      }))
      return { month, list, total, pageNum, pageSize, totalPage: Math.ceil(total / pageSize) }
    })
  }
}
