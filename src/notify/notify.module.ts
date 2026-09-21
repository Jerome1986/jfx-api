import { Module } from '@nestjs/common'
import { NotifyService } from './notify.service'
import { NotifyController } from './notify.controller'
import { NotifyRepository } from './notify.repository'
import { OrderRepository } from 'src/order/order.repository'
import { UserRepository } from 'src/user/user.repository'

@Module({
  controllers: [NotifyController],
  providers: [
    NotifyService,
    NotifyRepository,
    OrderRepository,
    UserRepository,
  ],
})
export class NotifyModule { }
