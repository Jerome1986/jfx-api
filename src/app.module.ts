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
    EmployeeModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
