// 文件说明：预约数据仓储，封装预约相关数据库访问。
import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { AppointmentType } from '../../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AppointmentRepository {
  constructor(private readonly prisma: PrismaService) { }

  // 查询预约用户的有效状态和联系方式
  findUser(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, mobile: true, status: true },
    })
  }

  // 查询已发布方案的预约所需信息
  findPublishedPlan(id: number) {
    return this.prisma.renewalPlan.findFirst({
      where: { id, status: 'PUBLISHED' },
      select: { id: true, summary: true },
    })
  }

  // 创建焕新方案预约记录
  createPlanAppointment(data: {
    appointmentNo: string
    userId: number
    planId: number
    mobile: string
    demand?: string
    snapshot: Prisma.InputJsonValue
  }) {
    return this.prisma.appointment.create({
      data: {
        ...data,
        customerName: null,
        type: 'PLAN',
        source: '空间焕新',
        status: 'PENDING_CONTACT',
      },
      select: { id: true, appointmentNo: true },
    })
  }

  // 查询预约列表；未传预约类型时查询全部
  async GetPlanAll(pageNum: number, pageSize: number, type?: AppointmentType) {
    const where: Prisma.AppointmentWhereInput = type ? { type } : {}

    return await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        include: {
          case: true,
          user: true,
          employee: {
            include: {
              user: {
                select: { realName: true }
              }
            }
          },
          plan: true,
          followUps: true,
          project: true,
        },
      }),
      this.prisma.appointment.count({ where }),
    ])
  }

  // 查询当前用户的预约列表
  async getMyAppointments(
    userId: number,
    pageNum: number,
    pageSize: number,
    type?: AppointmentType,
  ) {
    const where: Prisma.AppointmentWhereInput = {
      userId,
      ...(type ? { type } : {}),
    }

    return Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          case: true,
          employee: true,
          plan: true,
          followUps: true,
          project: true,
        },
      }),
      this.prisma.appointment.count({ where }),
    ])
  }

  findEmployeeByUserId(userId: number) {
    return this.prisma.employee.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        user: { select: { role: true, status: true } },
      },
    })
  }

  // 列表和总数均限定为当前员工负责的预约
  async getAssignedAppointments(
    employeeId: number,
    pageNum: number,
    pageSize: number,
    type?: AppointmentType,
  ) {
    const where: Prisma.AppointmentWhereInput = {
      employeeId,
      ...(type ? { type } : {}),
    }
    return Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          case: true,
          employee: true,
          plan: true,
          followUps: true,
          project: true,
        },
      }),
      this.prisma.appointment.count({ where }),
    ])
  }

  // 获取用户预约详情
  findOneForCustomer(id: number, userId: number) {
    return this.prisma.appointment.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        case: true,
        employee: {
          include: {
            user: {
              select: {
                realName: true,
              },
            },
          },
        },
        plan: true,
        followUps: true,
        project: true,
      },
    })
  }

  // 获取员工预约详情
  findOneForEmployee(id: number, employeeId: number) {
    return this.prisma.appointment.findFirst({
      where: {
        id,
        employeeId,
      },
      include: {
        case: true,
        user: {
          select: {
            id: true,
            realName: true,
            mobile: true,
          },
        },
        employee: {
          include: {
            user: {
              select: {
                realName: true,
              },
            },
          },
        },
        plan: true,
        followUps: true,
        project: true,
      },
    })
  }

  // 查询待跟进预约是否存在
  findAppointmentById(id: number) {
    return this.prisma.appointment.findUnique({
      where: { id },
      select: { id: true },
    })
  }

  // 查询跟进负责人是否存在
  findEmployeeById(id: number) {
    return this.prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    })
  }

  // 新增预约跟进记录
  createFollowUp(data: {
    appointmentId: number
    employeeId: number | null
    content: string
    nextFollowAt: Date | null
  }) {
    return this.prisma.followUp.create({
      data,
      select: {
        id: true,
        appointmentId: true,
        projectId: true,
        employeeId: true,
        content: true,
        nextFollowAt: true,
        createdAt: true,
      },
    })
  }

  // 查询取消操作所需的预约信息
  findAppointmentForCancel(id: number) {
    return this.prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        appointmentNo: true,
        type: true,
        status: true,
        canceledAt: true,
      },
    })
  }

  // 将焕新方案预约标记为已取消
  cancelPlanAppointment(id: number, canceledAt: Date) {
    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELED',
        canceledAt,
      },
      select: {
        id: true,
        appointmentNo: true,
        type: true,
        status: true,
        canceledAt: true,
      },
    })
  }

  // 装修计算器提交预约报价
  findBudgetAppointmentByUserId(userId: number) {
    return this.prisma.appointment.findFirst({
      where: {
        userId,
        type: 'BUDGET',
      },
      select: { id: true },
    })
  }

  // 装修计算器提交预约报价
  createBudgetAppointment(data: {
    appointmentNo: string
    userId: number
    type: AppointmentType
    source: string
    mobile: string
    houseType: string
    city: string
    area: Prisma.Decimal
    roomLayout: string
  }) {
    return this.prisma.appointment.create({ data })
  }

  // 根据用户ID查询用户预约记录
  findAppointmentByUser(userId: number) {
    return this.prisma.appointment.findMany({
      where: { userId }
    })
  }

  // 给预约方案分配负责人
  reassignResponsiblePerson(id: number, employeeId: number) {
    return this.prisma.appointment.update({
      where: { id },
      data: {
        employeeId
      },
      include: {
        employee: {
          select: {
            employeeNo: true,
            position: true,
            department: true,
            serviceRegions: true
          }
        }
      }
    })
  }
}
