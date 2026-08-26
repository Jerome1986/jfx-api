// 文件说明：地址模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { AddressRepository } from './address.repository';

// 地址模块：注册地址接口及其业务、数据访问服务
@Module({
  controllers: [AddressController],
  providers: [AddressService, AddressRepository],
})
export class AddressModule {}
