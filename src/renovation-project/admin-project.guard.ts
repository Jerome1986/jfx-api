import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AdminProjectGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  // 校验后台管理员的装修项目操作权限
  async canActivate(context: ExecutionContext) {
    const actor = context.switchToHttp().getRequest().user
    if (actor?.type !== 'admin')
      throw new ForbiddenException('仅后台管理员可操作装修项目')
    const admin = await this.prisma.admin.findUnique({
      where: { id: actor.userId },
      select: { status: true },
    })
    if (!admin?.status) throw new ForbiddenException('管理员账号不存在或已禁用')
    return true
  }
}
