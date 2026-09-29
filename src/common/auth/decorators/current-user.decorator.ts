import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type {
  AuthenticatedUserRequest,
  UserJwtPayload,
} from '../interfaces/user-jwt-payload.interface'

// 从请求上下文读取鉴权守卫写入的登录身份，供控制器参数使用。
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserJwtPayload =>
    context.switchToHttp().getRequest<AuthenticatedUserRequest>().user,
)
