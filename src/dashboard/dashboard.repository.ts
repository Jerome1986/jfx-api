import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { appointmentAlert, beijingCalendarDate, feedbackAlert, installationAlert, projectAlert } from '../common/filters/business-alert'
import { getBeijingMonthRange } from '../utils/date.util'

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  overview(now: Date) {
    const today = new Date(beijingCalendarDate(now).getTime() - 8 * 3600000)
    const month = getBeijingMonthRange(now).start
    return this.prisma.$transaction(async tx => {
      // 历史累计纳入已成交但缺少历史时间的记录；期间统计不能推算日期。
      const revenue = async (start?: Date) => {
        const project = await tx.renovationProject.aggregate({
          where: { status: { in: ['IN_SERVICE', 'COMPLETED'] }, ...(start ? { quoteConfirmedAt: { gte: start, lte: now } } : { OR: [{ quoteConfirmedAt: { lte: now } }, { quoteConfirmedAt: null }] }) },
          _sum: { contractAmount: true },
        })
        const order = await tx.productOrder.aggregate({
          where: { paymentStatus: { in: ['PAID', 'REFUNDING', 'REFUNDED'] }, ...(start ? { paidAt: { gte: start, lte: now } } : { OR: [{ paidAt: { lte: now } }, { paidAt: null }] }) },
          _sum: { paidAmount: true, refundAmount: true },
        })
        return new Prisma.Decimal(project._sum.contractAmount ?? 0)
          .plus(order._sum.paidAmount ?? 0).minus(order._sum.refundAmount ?? 0).toDecimalPlaces(2).toNumber()
      }
      const metrics = {
        todayCustomers: await tx.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: today, lte: now } } }),
        todayAppointments: await tx.appointment.count({ where: { createdAt: { gte: today, lte: now } } }),
        renovationProjects: await tx.renovationProject.count(),
        productOrders: await tx.productOrder.count(),
        todayRevenue: await revenue(today),
        monthRevenue: await revenue(month),
        totalRevenue: await revenue(),
      }
      const statuses = {
        appointmentPendingContact: await tx.appointment.count({ where: { status: 'PENDING_CONTACT' } }),
        appointmentPendingVisit: await tx.appointment.count({ where: { status: 'PENDING_VISIT' } }),
        projectPendingConfirm: await tx.renovationProject.count({ where: { status: 'PENDING_CONFIRM' } }),
        projectInService: await tx.renovationProject.count({ where: { status: 'IN_SERVICE' } }),
        orderPendingInstallation: await tx.productOrder.count({ where: { status: 'PENDING_INSTALLATION' } }),
        projectCompleted: await tx.renovationProject.count({ where: { status: 'COMPLETED' } }),
      }
      const alerts = {
        APPOINTMENT_UNCONTACTED: await tx.appointment.count({ where: appointmentAlert('uncontacted', now) }),
        APPOINTMENT_UNASSIGNED: await tx.appointment.count({ where: appointmentAlert('unassigned', now) }),
        PROJECT_OVERDUE: await tx.renovationProject.count({ where: projectAlert(now) }),
        INSTALLATION_OVERDUE: await tx.productOrder.count({ where: installationAlert(now) }),
        FEEDBACK_UNHANDLED: await tx.feedback.count({ where: feedbackAlert(now) }),
      }
      return { metrics, statuses, alerts }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  }
}
