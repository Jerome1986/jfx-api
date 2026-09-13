import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { UserJwtGuard } from './guards/user-jwt.guard'

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
  providers: [UserJwtGuard],
  exports: [JwtModule, UserJwtGuard],
})
export class AuthModule {}
