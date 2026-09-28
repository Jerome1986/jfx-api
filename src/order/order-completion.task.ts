import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { OrderService } from './order.service'

@Injectable()
export class OrderCompletionTask {
  constructor(private readonly orderService: OrderService) {}

  // 与安装自动完成共用任务服务，独立任务名防止重复执行。
  @Cron('0 * * * * *', { name: 'order-payment-timeout', waitForCompletion: true })
  async handleExpiredPayments() {
    await this.orderService.closeExpiredPayments()
  }

  // 单实例避免任务重叠，多实例依靠数据库条件更新保证只完成一次。
  @Cron('0 * * * * *', { name: 'order-auto-completion', waitForCompletion: true })
  async handleExpiredConfirmations() {
    await this.orderService.autoCompleteExpiredOrders()
  }
}
