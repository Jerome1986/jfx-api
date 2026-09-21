import { Module } from '@nestjs/common';
import { OrderCompletionTask } from './order-completion.task';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { AuthModule } from '../common/auth/auth.module';
import { OrderRepository } from './order.repository';
import { OrderPreparationService } from './order-preparation.service';
import { UserCouponRepository } from 'src/user-coupon/user-coupon.repository';
import { PaymentService } from 'src/payment/payment.service';

@Module({
  imports: [AuthModule],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderCompletionTask,
    OrderPreparationService,
    OrderRepository,
    UserCouponRepository,
    PaymentService
  ],
})
export class OrderModule { }
