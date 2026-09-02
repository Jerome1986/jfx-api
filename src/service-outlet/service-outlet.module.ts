// 文件说明：服务网点模块，集中注册控制器、业务服务和数据仓储。
import { Module } from '@nestjs/common'
import { ServiceOutletController } from './service-outlet.controller'
import { ServiceOutletRepository } from './service-outlet.repository'
import { ServiceOutletService } from './service-outlet.service'

// 注册服务网点模块所需的控制器及依赖
@Module({
  controllers: [ServiceOutletController],
  providers: [ServiceOutletService, ServiceOutletRepository],
})
export class ServiceOutletModule {}
