// 文件说明：用户模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { WxUtil } from 'src/utils/wx.util';
import { AuthModule } from '../common/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, UserRepository, WxUtil],
  exports: [UserRepository],
})
export class UserModule { }
