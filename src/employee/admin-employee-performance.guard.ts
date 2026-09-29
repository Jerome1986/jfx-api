import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AdminEmployeePerformanceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  // 令牌由 UserJwtGuard 校验，此处核实后台身份及账号状态。
  async canActivate(context: ExecutionContext) {
    const actor = context.switchToHttp().getRequest().user
    if (actor?.type !== 'admin') throw new ForbiddenException('仅后台管理员可查看员工业绩')
    const admin = await this.prisma.admin.findUnique({
      where: { id: actor.userId }, select: { status: true },
    })
    if (!admin?.status) throw new ForbiddenException('管理员账号不存在或已禁用')
    return true
  }
}
