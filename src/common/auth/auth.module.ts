import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { UserJwtGuard } from './guards/user-jwt.guard'

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // 读取 SECRET 配置，创建 JWT 签名配置，并将令牌有效期设为 7 天。
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [UserJwtGuard],
  exports: [JwtModule, UserJwtGuard],
})
export class AuthModule {}
