import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type {
  AuthenticatedUserRequest,
  UserJwtPayload,
} from '../interfaces/user-jwt-payload.interface'

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserJwtPayload =>
    context.switchToHttp().getRequest<AuthenticatedUserRequest>().user,
)
