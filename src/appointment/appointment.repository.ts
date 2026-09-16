// 文件说明：预约数据仓储，封装预约相关数据库访问。
import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { AppointmentStatus, AppointmentType } from '../../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { ConfirmVisitDto } from './dto/confirm-visit-appointment.dto'
import { UpdateAppointmentRequirementDto } from './dto/update-appointment-requirement.dto'

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

  // 查询可预约报价的已发布装修案例
  findPublishedCase(id: number) {
    return this.prisma.renovationCase.findFirst({
      where: { id, status: 'PUBLISHED' },
      select: { id: true },
    })
  }

  // 在事务中检查重复案例预约、累计咨询次数并创建预约
  createCaseAppointment(data: { appointmentNo: string; userId: number; caseId: number; mobile: string }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.appointment.findFirst({
        where: {
          userId: data.userId,
          caseId: data.caseId,
          type: 'CASE',
          status: { in: ['PENDING_CONTACT', 'PENDING_VISIT'] },
        },
        select: { id: true },
      })
      if (existing) return null

      await tx.renovationCase.update({
        where: { id: data.caseId, status: 'PUBLISHED' },
        data: { quoteCount: { increment: 1 } },
      })
      return tx.appointment.create({
        data: { ...data, type: 'CASE', source: '装修案例', status: 'PENDING_CONTACT' },
        select: { id: true, appointmentNo: true },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
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
  async GetPlanAll(userId: number, pageNum: number, pageSize: number, type?: AppointmentType) {
    const where: Prisma.AppointmentWhereInput = { userId }
    if (type) where.type = type

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
        orderBy: { updatedAt: 'desc' }
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

  // 根据用户ID查询员工表
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
                id: true,
                realName: true,
                mobile: true
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

  // 查询启用中的后台管理员，避免已停用账号继续使用旧 Token
  findEnabledAdminById(id: number) {
    return this.prisma.admin.findFirst({
      where: { id, status: true },
      select: { id: true },
    })
  }

  // 后台管理员可查看任意预约详情
  findOneForAdmin(id: number) {
    return this.prisma.appointment.findUnique({
      where: { id },
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

  // 查询预约转项目所需的客户及负责人信息
  findAppointmentForProject(id: number) {
    return this.prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true, userId: true, employeeId: true,
        type: true, status: true, estimatedAmount: true,
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

  // 将方案预约标记为已取消
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

  // 仅查询尚未结束的预算预约，已完成或已取消后允许再次提交。
  findBudgetAppointmentByUserId(userId: number) {
    return this.prisma.appointment.findFirst({
      where: {
        userId,
        type: 'BUDGET',
        status: {
          in: [AppointmentStatus.PENDING_CONTACT, AppointmentStatus.PENDING_VISIT],
        },
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

  // 根据用户ID查询用户预约订单记录
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

  //将预约状态转换成待上门
  appointmentConfirmVisit(id: number, dto: ConfirmVisitDto, employeeId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma

    return db.appointment.update({
      where: { id, employeeId, status: AppointmentStatus.PENDING_CONTACT },
      data: {
        visitDate: new Date(dto.visitDate),
        timeSlot: dto.timeSlot,
        visitAddress: dto.visitAddress,
        status: AppointmentStatus.PENDING_VISIT,
      }
    })
  }

  // 当前负责人补录尚未结束预约的客户及房屋需求信息
  updateRequirement(
    id: number,
    employeeId: number,
    data: Omit<UpdateAppointmentRequirementDto, 'area'> & { area?: Prisma.Decimal },
  ) {
    return this.prisma.appointment.update({
      where: {
        id,
        employeeId,
        status: { in: [AppointmentStatus.PENDING_CONTACT, AppointmentStatus.PENDING_VISIT] },
      },
      data,
      include: {
        case: true,
        user: true,
        employee: { include: { user: { select: { realName: true, mobile: true } } } },
        plan: true,
        followUps: true,
        project: true,
      },
    })
  }

  // 仅允许当前负责人将待上门预约完成，同时记录服务端完成时间。
  appointmentCompleted(
    id: number,
    employeeId: number,
    type: AppointmentType,
    estimate?: { estimatedAmount: Prisma.Decimal; estimateDescription: string | null },
  ) {
    const now = new Date()
    return this.prisma.appointment.update({
      where: { id, employeeId, type, status: AppointmentStatus.PENDING_VISIT },
      data: {
        status: AppointmentStatus.COMPLETED,
        completedAt: now,
        ...(estimate ? { ...estimate, estimatedAt: now } : {}),
      },
    })
  }

  // 更新预约表的状态
  changeAppointmentStatus(id: number, status: AppointmentStatus, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.appointment.update({
      where: { id },
      data: { status }
    })
  }
}
