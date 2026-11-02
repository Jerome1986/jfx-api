// 文件说明：地址模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { AddressRepository } from './address.repository';
import { AuthModule } from '../common/auth/auth.module';

// 地址模块：注册地址接口及其业务、数据访问服务
@Module({
  imports: [AuthModule],
  controllers: [AddressController],
  providers: [AddressService, AddressRepository],
})
export class AddressModule {}
