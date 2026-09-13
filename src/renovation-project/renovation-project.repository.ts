import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { Prisma, RenovationProjectStatus } from "../../generated/prisma/browser";
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
      userId
    }
    if (status !== 'ALL') where.status = status

    return await Promise.all([
      this.prisma.renovationProject.findMany({
        where,
        include: { quoteItems: true },
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
  findOne(id: number) {
    return this.prisma.renovationProject.findFirst({
      where: { id },
      include: { quoteItems: true }
    })
  }
}
