import { Module } from '@nestjs/common'
import { ConstructionServiceController } from './construction-service.controller'
import { ConstructionServiceRepository } from './construction-service.repository'
import { ConstructionServiceService } from './construction-service.service'

// 注册施工服务模块的控制器、业务服务和数据仓库
@Module({
  controllers: [ConstructionServiceController],
  providers: [ConstructionServiceService, ConstructionServiceRepository],
})
export class ConstructionServiceModule {}
