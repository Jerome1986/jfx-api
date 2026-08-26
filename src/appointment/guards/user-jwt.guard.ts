import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'

export interface UserJwtPayload {
  userId: number
  role: string
  type: 'user'
}

export type AuthenticatedUserRequest = Request & { user: UserJwtPayload }

@Injectable()
export class UserJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedUserRequest>()
    const authorization = request.headers.authorization
    const [scheme, token] = authorization?.split(' ') ?? []

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('请先登录')
    }

    try {
      const payload = await this.jwtService.verifyAsync<UserJwtPayload>(token)
      if (payload.type !== 'user' || !payload.userId) {
        throw new UnauthorizedException('登录凭证无效')
      }
      request.user = payload
      return true
    } catch {
      throw new UnauthorizedException('登录凭证无效或已过期')
    }
  }
}
