import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type {
  AuthenticatedUserRequest,
  UserJwtPayload,
} from '../interfaces/user-jwt-payload.interface'

@Injectable()
export class UserJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) { }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedUserRequest>()
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('请先登录')
    }

    try {
      const payload = await this.jwtService.verifyAsync<UserJwtPayload>(token)
      console.log('登录凭证', payload)

      if (
        payload.type !== 'user' ||
        !Number.isInteger(payload.userId) ||
        payload.userId <= 0
      ) {
        throw new UnauthorizedException('登录凭证无效')
      }
      request.user = payload
      return true
    } catch {
      throw new UnauthorizedException('登录凭证无效或已过期')
    }
  }
}
