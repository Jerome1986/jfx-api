import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type MonthRange = { start: Date; end: Date }

@Injectable()
export class AdminEmployeePerformanceRepository {
  // 注入 Prisma 服务，供业绩查询和事务使用。
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 在可重复读事务中执行查询，保证员工、业绩和客户分组使用同一个数据快照。
   * work 接收事务客户端；内部查询须使用该客户端，返回值作为事务结果返回。
   * 此方法用于只读统计，查询异常由调用方接收，不在此处转换为默认数据。
   */
  withSnapshot<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  }

  /**
   * 使用传入的事务客户端查询全部员工，包括停用和无业绩员工。
   * 仅返回展示、筛选及有效员工判断所需字段，不读取密码等无关信息。
   * 排名、筛选和分页由 Service 统一处理。
   */
  findEmployees(tx: Prisma.TransactionClient) {
    return tx.employee.findMany({
      select: {
        id: true, employeeNo: true, department: true, position: true, status: true,
        user: { select: { realName: true, nickname: true, mobile: true, role: true, status: true } },
      },
    })
  }

  /**
   * 构建完工业绩的公共条件：项目已完成且已分配负责人。
   * range 为完成时间范围，包含 start、不包含 end；不传表示累计，
   * 此时不限制完成时间，保留缺少完成时间的历史完工项目。
   */
  private completedWhere(range?: MonthRange): Prisma.RenovationProjectWhereInput {
    return {
      status: 'COMPLETED', employeeId: { not: null },
      ...(range ? { completedAt: { gte: range.start, lt: range.end } } : {}),
    }
  }

  /**
   * 在指定事务和时间范围内，按员工汇总完工项目的合同金额及项目数量。
   * 不排除停用员工；无项目的员工不会返回分组，由 Service 补零。
   * 合同金额全部为空时汇总金额为 null，Service 按零处理。
   */
  aggregateCompleted(tx: Prisma.TransactionClient, range?: MonthRange) {
    return tx.renovationProject.groupBy({
      by: ['employeeId'], where: this.completedWhere(range),
      _sum: { contractAmount: true }, _count: { _all: true },
    })
  }

  /**
   * 查询当页 employeeIds 对应员工的完工项目，按员工 ID 和客户手机号分组。
   * tx 和 range 与业绩汇总保持一致，不加载项目明细或逐员工查询。
   * 返回手机号分组；Service 再去除首尾空白、忽略空号码并计算去重客户数。
   */
  findCustomerGroups(tx: Prisma.TransactionClient, employeeIds: number[], range?: MonthRange) {
    return tx.renovationProject.groupBy({
      by: ['employeeId', 'mobile'],
      where: { ...this.completedWhere(range), employeeId: { in: employeeIds } },
    })
  }
}
