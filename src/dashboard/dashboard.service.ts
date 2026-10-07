import { Injectable } from '@nestjs/common'
import { DashboardRepository } from './dashboard.repository'

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}
  async overview() {
    const result = await this.repository.overview(new Date())
    const metricLabels = {
      todayCustomers: ['今日新增客户', '人'], todayAppointments: ['今日新增预约', '条'],
      renovationProjects: ['装修项目数量', '个'], productOrders: ['商品订单数量', '单'],
      todayRevenue: ['今日成交金额', '元'], monthRevenue: ['本月成交金额', '元'],
      totalRevenue: ['历史累计成交金额', '元'],
    }
    const statusLabels = {
      appointmentPendingContact: '待联系预约', appointmentPendingVisit: '待上门预约',
      projectPendingConfirm: '待确认项目', projectInService: '服务中项目',
      orderPendingInstallation: '待安装订单', projectCompleted: '已完成项目',
    }
    const definitions = [
      { id: 'alert-appointment-uncontacted', type: 'APPOINTMENT_UNCONTACTED', title: '预约长时间未联系', description: '存在提交超过 2 小时且尚未联系的客户预约', level: 'danger', targetPath: '/renovation/appointment', query: { alertType: 'uncontacted' } },
      { id: 'alert-appointment-unassigned', type: 'APPOINTMENT_UNASSIGNED', title: '预约未分配负责人', description: '存在未分配负责员工的有效预约', level: 'warning', targetPath: '/renovation/appointment', query: { alertType: 'unassigned' } },
      { id: 'alert-project-overdue', type: 'PROJECT_OVERDUE', title: '装修项目逾期', description: '存在超过计划完成日期且尚未完成的项目', level: 'danger', targetPath: '/renovation/projects', query: { alertType: 'overdue' } },
      { id: 'alert-installation-overdue', type: 'INSTALLATION_OVERDUE', title: '订单安装逾期', description: '存在超过预约时段结束时间且尚未完成安装的订单', level: 'warning', targetPath: '/trade/orders', query: { alertType: 'overdue' } },
      { id: 'alert-feedback-unhandled', type: 'FEEDBACK_UNHANDLED', title: '反馈长时间未处理', description: '存在提交超过 24 小时且仍待处理的反馈', level: 'warning', targetPath: '/support/feedback', query: { alertType: 'overdue' } },
    ] as const
    return {
      businessMetrics: Object.entries(metricLabels).map(([key, [label, unit]]) => ({ key, label, value: result.metrics[key], unit })),
      businessStatuses: Object.entries(statusLabels).map(([key, label]) => ({ key, label, count: result.statuses[key] })),
      alerts: definitions.map(item => ({ ...item, count: result.alerts[item.type] })).filter(item => item.count > 0),
    }
  }
}
