import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { OrderService } from './order.service'

@Injectable()
export class OrderCompletionTask {
  constructor(private readonly orderService: OrderService) {}

  // 单实例避免任务重叠，多实例依靠数据库条件更新保证只完成一次。
  @Cron('0 * * * * *', { name: 'order-auto-completion', waitForCompletion: true })
  async handleExpiredConfirmations() {
    await this.orderService.autoCompleteExpiredOrders()
  }
}
