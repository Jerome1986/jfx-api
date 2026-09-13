import type { Request } from 'express'
import { UserRole } from '../../../../generated/prisma/enums'

export interface UserJwtPayload {
  userId: number
  role: UserRole
  type: 'user'
}

export type AuthenticatedUserRequest = Request & { user: UserJwtPayload }
