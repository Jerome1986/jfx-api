import { Module } from '@nestjs/common'
import { ServiceCityController } from './service-city.controller'
import { ServiceCityRepository } from './service-city.repository'
import { ServiceCityService } from './service-city.service'

@Module({
  controllers: [ServiceCityController],
  providers: [ServiceCityService, ServiceCityRepository],
})
export class ServiceCityModule {}
