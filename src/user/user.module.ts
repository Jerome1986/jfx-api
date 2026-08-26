// 文件说明：用户模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { WxUtil } from 'src/utils/wx.util';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [UserController],
  providers: [UserService, UserRepository, WxUtil],
  exports: [UserRepository],
})
export class UserModule { }
