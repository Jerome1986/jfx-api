import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { AuthModule } from '../common/auth/auth.module';
import { OrderRepository } from './order.repository';

@Module({
  imports: [AuthModule],
  controllers: [OrderController],
  providers: [OrderService, OrderRepository],
})
export class OrderModule { }
