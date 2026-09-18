import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { ProjectStatus } from "./dto/query-user-renovation-project.dto";

@Injectable()
export class RenovationProjectRepository {
  constructor(private prisma: PrismaService) { }

  // 创建项目表
  createRenovationProject(data: Prisma.RenovationProjectUncheckedCreateInput) {
    return this.prisma.renovationProject.create({
      data
    })
  }

  // 获取指定用户装修列表
  async findAllByUser(userId: number, status: ProjectStatus, pageNum: number, pageSize: number) {
    let where: any = {
      userId,
      status: { notIn: ['PENDING_QUOTE'] }
    }
    if (status !== 'ALL') where.status = status

    return await Promise.all([
      this.prisma.renovationProject.findMany({
        where,
        include: { plan: true, quoteItems: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.renovationProject.count({ where })
    ])
  }

  // 根据 appointmentId 查询是否有已经创建过的项目
  getProjectByAppointmentId(appointmentId: number) {
    return this.prisma.renovationProject.findFirst({
      where: { appointmentId }
    })
  }

  // 项目详情
  findOne(id: number, userId: number) {
    return this.prisma.renovationProject.findFirst({
      where: { id, userId },
      include: { plan: true, quoteItems: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } }
    })
  }

  // 用户确认报价开始装修服务
  confirmProject(id: number, userId: number, project: { updatedAt: Date; quotedAmount: Prisma.Decimal; quoteVersion: number }) {
    return this.prisma.renovationProject.update({
      // 条件更新防止读取之后的取消、归属变更或报价修改被覆盖。
      where: {
        id,
        userId,
        status: 'PENDING_CONFIRM',
        quoteVersion: project.quoteVersion,
        updatedAt: project.updatedAt,
        quotedAmount: project.quotedAmount,
      },
      data: {
        status: 'IN_SERVICE',
        contractAmount: project.quotedAmount,
      }
    })
  }
}
