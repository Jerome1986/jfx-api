import { legacyProjectOmit } from './legacy-project-fields';
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
      omit: legacyProjectOmit,
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
      omit: legacyProjectOmit,
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
      omit: legacyProjectOmit,
      where: { appointmentId }
    })
  }

  // 项目详情
  findOne(id: number, userId: number) {
    return this.prisma.renovationProject.findFirst({
      omit: legacyProjectOmit,
      where: { id, userId },
      include: { plan: true, quoteItems: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } }
    })
  }

  // 用户确认报价开始装修服务
  confirmProject(id: number, userId: number, project: { updatedAt: Date; quotedAmount: Prisma.Decimal; quoteVersion: number }) {
    return this.prisma.renovationProject.update({
      omit: legacyProjectOmit,
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
        progress: '客户已确认报价，开始服务',
        progresses: { create: { status: 'IN_SERVICE', content: '客户已确认报价，开始服务', createdBy: `user:${userId}` } },
      }
    })
  }
}
