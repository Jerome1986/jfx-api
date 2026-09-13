// 文件说明：应用根模块，集中注册各业务模块。
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { PrismaModule } from './prisma/prisma.modules';
import { ScheduleModule } from '@nestjs/schedule'
import { ConfigModule } from '@nestjs/config'
import { CaseModule } from './case/case.module';
import { CaseCategoryModule } from './case-category/case-category.module';
import { BannerModule } from './banner/banner.module';
import { RenewalPlanModule } from './renewal-plan/renewal-plan.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { ProductModule } from './product/product.module';
import { UserModule } from './user/user.module';
import { AddressModule } from './address/address.module';
import { EmployeeModule } from './employee/employee.module';
import { ConstructionServiceModule } from './construction-service/construction-service.module';
import { AppointmentModule } from './appointment/appointment.module';
import { FavoriteModule } from './favorite/favorite.module';
import { ServiceOutletModule } from './service-outlet/service-outlet.module';
import { ServiceCityModule } from './service-city/service-city.module';
import { RenovationProjectModule } from './renovation-project/renovation-project.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AdminModule,
    CaseModule,
    CaseCategoryModule,
    BannerModule,
    RenewalPlanModule,
    ProductCategoryModule,
    ProductModule,
    UserModule,
    AddressModule,
    EmployeeModule,
    ConstructionServiceModule,
    AppointmentModule,
    FavoriteModule,
    ServiceOutletModule,
    ServiceCityModule,
    RenovationProjectModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
