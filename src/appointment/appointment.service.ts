// 文件说明：预约业务服务，负责预约创建流程编排。
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { Decimal, PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { randomBytes } from 'node:crypto'
import { AdminRole, AppointmentType } from '../../generated/prisma/enums'
import { AppointmentRepository } from './appointment.repository'
import { CreateFollowUpDto } from './dto/create-follow-up.dto'
import { CreatePlanAppointmentDto } from './dto/create-plan-appointment.dto'
import { AppointmentTypeFilter, QueryPlanAppointmentDto } from './dto/query-plan-appointment.dto'
import { CreateBudgetAppointmentDto } from './dto/create-budget-appointment.dto'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'
import { ConfirmVisitDto } from './dto/confirm-visit-appointment.dto'
import { CompleteAppointmentDto } from './dto/complete-appointment.dto'
import { toAppointmentResponse } from './appointment-response'

@Injectable()
export class AppointmentService {
  constructor(
    private readonly appointmentRepo: AppointmentRepository,
  ) { }

  // 创建焕新方案预约
  async createPlanAppointment(dto: CreatePlanAppointmentDto) {
    // 第一步：校验登录用户
    const user = await this.getAvailableUser(dto.userId)

    // 第二步：查询已发布的焕新方案
    const plan = await this.appointmentRepo.findPublishedPlan(dto.planId)
    if (!plan) {
      throw new NotFoundException('焕新方案不存在或已下线')
    }

    // 第三步：预约属于待员工复核的线索，直接保存前端提交的选择快照
    const snapshot = {
      title: dto.snapshot.title,
      cover: dto.snapshot.cover ?? null,
      referencePrice: dto.snapshot.referencePrice,
      items: dto.snapshot.items.map((item) => ({
        sourceItemId: item.sourceItemId,
        candidateId: item.candidateId ?? null,
        productId: item.productId ?? null,
        category: item.category,
        name: item.name,
        description: item.description ?? null,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        image: item.image ?? null,
      })),
    }
    const appointment = await this.appointmentRepo.createPlanAppointment({
      appointmentNo: this.generateAppointmentNo(),
      userId: user.id,
      planId: plan.id,
      mobile: user.mobile,
      demand: plan.summary ?? undefined,
      snapshot,
    })

    // 第四步：返回预约记录 ID 和预约编号
    return {
      appointmentId: appointment.id,
      appointmentNo: appointment.appointmentNo,
    }
  }

  // 查询并校验预约用户
  private async getAvailableUser(userId?: number | null) {
    if (!userId) {
      throw new UnauthorizedException('请先登录后再预约')
    }

    const user = await this.appointmentRepo.findUser(userId)
    if (!user) {
      throw new UnauthorizedException('登录状态无效，请重新登录')
    }
    if (!user.status) {
      throw new ForbiddenException('账号已被禁用')
    }
    return user
  }

  // 生成带时间戳和随机值的预约编号
  private generateAppointmentNo() {
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 17)
    const random = randomBytes(3).toString('hex').toUpperCase()
    return `APT${timestamp}${random}`
  }

  // 获取预约列表；不传类型或传 ALL 时查询全部预约
  async GetPlanAll(
    query: QueryPlanAppointmentDto,
    user: UserJwtPayload
  ) {
    const pageNum = Number(query.pageNum) || 1
    const pageSize = Number(query.pageSize) || 10
    const userId = user.userId
    const type = query.type

    const appointmentType: AppointmentType | undefined =
      type && type !== 'ALL' ? type : undefined
    const [list, total] = await this.appointmentRepo.GetPlanAll(
      userId,
      pageNum,
      pageSize,
      appointmentType,
    )

    return {
      list: list.map(toAppointmentResponse),
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
    }
  }

  // 获取当前登录用户的预约列表
  async getMyAppointments(
    userId: number,
    pageNum: number,
    pageSize: number,
    type?: AppointmentTypeFilter,
  ) {
    const appointmentType: AppointmentType | undefined =
      type && type !== 'ALL' ? type : undefined
    const [list, total] = await this.appointmentRepo.getMyAppointments(
      userId,
      pageNum,
      pageSize,
      appointmentType,
    )

    return {
      list: list.map(toAppointmentResponse),
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
    }
  }

  // 根据用户 ID 确定员工身份，查询其负责的预约
  async getAssignedAppointments(
    userId: number,
    pageNum: number,
    pageSize: number,
    type?: AppointmentTypeFilter,
  ) {
    const employee = await this.appointmentRepo.findEmployeeByUserId(userId)
    if (!employee || employee.user.role !== 'EMPLOYEE') {
      throw new ForbiddenException('仅员工可查询负责的预约')
    }
    if (!employee.status || !employee.user.status) {
      throw new ForbiddenException('员工或用户账号已被禁用')
    }

    const appointmentType = type && type !== 'ALL' ? type : undefined
    const [list, total] = await this.appointmentRepo.getAssignedAppointments(
      employee.id,
      pageNum,
      pageSize,
      appointmentType,
    )
    return {
      list: list.map(toAppointmentResponse),
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
    }
  }

  // 获取方案预约详情
  async findOne(id: number, payload: UserJwtPayload) {
    let appointment
    if (payload.role === 'CUSTOMER') {
      // 普通用户只能查看自己的预约
      appointment = await this.appointmentRepo.findOneForCustomer(id, payload.userId)
    } else if (payload.role === 'EMPLOYEE') {
      // 先找到对应的员工ID Employee.id
      const employee = await this.appointmentRepo.findEmployeeByUserId(payload.userId)
      if (!employee || !employee.status || !employee.user.status) {
        throw new ForbiddenException('员工账号不存在或被禁用')
      }

      // 员工只能查看分配给自己的预约
      appointment = await this.appointmentRepo.findOneForEmployee(id, employee.id)
    } else if (Object.values(AdminRole).includes(payload.role as AdminRole)) {
      // 所有后台管理员角色均可查看预约详情
      const admin = await this.appointmentRepo.findEnabledAdminById(payload.userId)
      if (!admin) {
        throw new ForbiddenException('管理员账号不存在或被禁用')
      }
      appointment = await this.appointmentRepo.findOneForAdmin(id)
    } else {
      throw new ForbiddenException('无权查看预约详情')
    }

    if (!appointment) {
      throw new NotFoundException('预约不存在')
    }

    return toAppointmentResponse(appointment)
  }

  // 后台新增预约跟进记录
  async createFollowUp(appointmentId: number, dto: CreateFollowUpDto) {
    const appointment =
      await this.appointmentRepo.findAppointmentById(appointmentId)
    if (!appointment) {
      throw new NotFoundException('预约不存在')
    }

    if (dto.employeeId) {
      const employee = await this.appointmentRepo.findEmployeeById(
        dto.employeeId,
      )
      if (!employee) {
        throw new NotFoundException('跟进负责人不存在')
      }
    }

    console.log('跟进参数提交', dto)

    const res = await this.appointmentRepo.createFollowUp({
      appointmentId,
      employeeId: dto.employeeId ?? null,
      content: dto.content,
      nextFollowAt: dto.nextFollowAt ? new Date(dto.nextFollowAt) : null,
    })
    console.log('跟进记录', res)

    return res
  }

  // 取消焕新方案预约
  async cancelPlanAppointment(id: number) {
    const appointment = await this.appointmentRepo.findAppointmentForCancel(id)
    if (!appointment) {
      throw new NotFoundException('预约不存在')
    }
    if (appointment.type !== 'PLAN') {
      throw new BadRequestException('该预约不是焕新方案预约')
    }
    if (appointment.status === 'COMPLETED') {
      throw new BadRequestException('已完成的预约不能取消')
    }
    if (appointment.status === 'CANCELED') {
      return appointment
    }

    return this.appointmentRepo.cancelPlanAppointment(id, new Date())
  }

  // 装修计算器预约提交
  async createBudgetAppointment(
    createBudgetAppointmentDto: CreateBudgetAppointmentDto,
  ) {
    const existingAppointment =
      await this.appointmentRepo.findBudgetAppointmentByUserId(
        createBudgetAppointmentDto.userId,
      )
    if (existingAppointment) {
      throw new BadRequestException('您有待联系或待上门的预算预约，请勿重复提交')
    }

    return this.appointmentRepo.createBudgetAppointment({
      ...createBudgetAppointmentDto,
      area: new Decimal(createBudgetAppointmentDto.area),
    })
  }

  // 给预约方案分配负责人
  async reassignResponsiblePerson(id: number, employeeId: number) {
    const res = await this.appointmentRepo.reassignResponsiblePerson(id, employeeId)
    console.log(res)
    return res
  }

  // 将预约状态转换成待上门
  async appointmentConfirmVisit(id: number, dto: ConfirmVisitDto, user: UserJwtPayload) {
    // 1. Guard 已验证 Token，此处只校验员工业务身份。
    if (user.role !== 'EMPLOYEE') throw new ForbiddenException('当前账号没有权限')
    const employee = await this.appointmentRepo.findEmployeeByUserId(user.userId)
    if (!employee?.status || !employee.user.status || employee.user.role !== 'EMPLOYEE') {
      throw new ForbiddenException('当前员工账号不可用')
    }
    // 2. 校验预约是否分配给当前员工。
    const appointment = await this.appointmentRepo.findOneForEmployee(id, employee.id)
    if (!appointment) throw new NotFoundException('预约不存在或无权访问')
    // 3. 校验当前状态必须为 `PENDING_CONTACT`。
    if (appointment.status !== 'PENDING_CONTACT') {
      throw new ConflictException('当前预约状态不允许确认上门')
    }
    // 4. 原子更新上门信息和状态，写入时再次限制负责人及原状态。
    try {
      return await this.appointmentRepo.appointmentConfirmVisit(id, dto, employee.id)
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException('预约状态或负责人已变更，请刷新后重试')
      }
      throw error
    }
  }

  // 完成预约
  async completeAppointment(id: number, user: UserJwtPayload, dto: CompleteAppointmentDto = {}) {
    // 1.校验当前员工身份
    if (user.role !== 'EMPLOYEE') throw new ForbiddenException('当前账号没有权限')
    const employee = await this.appointmentRepo.findEmployeeByUserId(user.userId)
    if (!employee?.status || !employee.user.status || employee.user.role !== 'EMPLOYEE') {
      throw new ForbiddenException('当前员工账号不可用')
    }

    // 2. 校验预约是否分配给当前员工。
    const appointment = await this.appointmentRepo.findOneForEmployee(id, employee.id)
    if (!appointment) throw new NotFoundException('预约不存在或无权访问')

    // 3. 仅允许待上门预约标记为已完成。
    if (appointment.status !== 'PENDING_VISIT') {
      throw new ConflictException('当前预约状态不允许完成服务')
    }

    const isQuote = appointment.type === 'BUDGET' || appointment.type === 'QUOTE'
    if (isQuote && !dto.estimatedAmount) {
      throw new BadRequestException('报价类预约必须填写预估金额')
    }
    const estimate = isQuote ? {
      estimatedAmount: new Decimal(dto.estimatedAmount!),
      estimateDescription: dto.estimateDescription?.trim() || null,
    } : undefined

    // 4. 同一次条件更新保存预估报价和完成状态，避免部分写入。
    try {
      const result = await this.appointmentRepo.appointmentCompleted(
        id, employee.id, appointment.type, estimate,
      )
      return toAppointmentResponse(result)
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException('预约状态或负责人已变更，请刷新后重试')
      }
      throw error
    }
  }
}
