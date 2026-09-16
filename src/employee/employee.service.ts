// 文件说明：员工业务服务，负责业务规则与流程编排。
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeRepository } from './employee.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { UserRepository } from 'src/user/user.repository';
import { Prisma } from '../../generated/prisma/client';
import { generateRandomCode } from 'src/utils/random.util';
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { RenovationProjectRepository } from 'src/renovation-project/renovation-project.repository';
import { AppointmentRepository } from '../appointment/appointment.repository';
import { QueryEmployeeProjectDto } from './dto/query-employee-project.dto';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly employeeRepo: EmployeeRepository,
    private readonly userRepo: UserRepository,
    private readonly renovationProjectRepo: RenovationProjectRepository,
    private readonly appointmentRepo: AppointmentRepository,
    private readonly prisma: PrismaService,
  ) { }

  // 新增员工：处理用户注册、身份变更和员工档案创建
  async create(createEmployeeDto: CreateEmployeeDto) {
    // 1. 拆分用户账号信息和员工档案信息
    const {
      mobile,
      nickname,
      realName,
      hiredAt,
      ...employeeData
    } = createEmployeeDto

    try {
      // 2. 开启事务，保证用户和员工数据同时成功或同时回滚
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 3. 根据手机号查询用户是否已经注册
        let user = await this.userRepo.findByMobile(mobile, tx)

        if (user) {
          // 4.1 用户已注册，检查是否已经存在员工档案
          const existingEmployee = await this.employeeRepo.findByUserId(user.id, tx)
          if (existingEmployee) {
            throw new BadRequestException('该手机号已经是员工')
          }

          // 4.2 将已注册用户的身份修改为员工
          await this.userRepo.updateRoleToEmployee(user.id, tx)
        } else {
          // 4.3 用户未注册，创建员工用户并取得数据库生成的用户 ID
          user = await this.userRepo.createEmployeeUser(
            {
              mobile,
              nickname,
              realName,
            },
            tx,
          )
        }

        // 5. 使用真实用户 ID 和后端生成的员工编号创建员工档案
        return this.employeeRepo.create(
          {
            ...employeeData,
            userId: user.id,
            employeeNo: generateRandomCode(),
            hiredAt: hiredAt ? new Date(hiredAt) : undefined,
          },
          tx,
        )
      })
    } catch (error) {
      // 6. 保留主动抛出的业务异常，统一处理数据库异常
      if (error instanceof BadRequestException) throw error
      throw new BadRequestException('员工新增失败，请检查用户、手机号或员工编号是否重复')
    }
  }

  // 分页查询员工列表
  async findAll(query: QueryEmployeeDto) {
    // 1. 查询员工列表和符合条件的总数量
    const [list, total] = await this.employeeRepo.findAll(query)
    // 2. 组装分页返回结果
    return {
      list,
      total,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      totalPage: Math.ceil(total / query.pageSize),
    }
  }

  // 获取当前登录员工负责业务的状态汇总
  async summary(user: UserJwtPayload) {
    if (user.role !== 'EMPLOYEE') {
      throw new ForbiddenException('仅员工可查看工作概览')
    }

    const employee = await this.employeeRepo.findByUserId(user.userId)
    if (
      !employee ||
      !employee.status ||
      !employee.user.status ||
      employee.user.role !== 'EMPLOYEE'
    ) {
      throw new ForbiddenException('当前员工账号不可用')
    }

    return this.employeeRepo.summary(employee.id)
  }

  // 校验当前用户的员工身份和账号状态，返回员工档案
  private async requireActiveEmployee(user: UserJwtPayload) {
    if (user.role !== 'EMPLOYEE') throw new ForbiddenException('仅员工可操作装修订单')
    const employee = await this.employeeRepo.findByUserId(user.userId)
    if (!employee || !employee.status || !employee.user.status || employee.user.role !== 'EMPLOYEE') {
      throw new ForbiddenException('当前员工账号不可用')
    }
    return employee
  }

  // 分页查询当前员工负责的装修订单
  async findProjects(query: QueryEmployeeProjectDto, user: UserJwtPayload) {
    const employee = await this.requireActiveEmployee(user)
    const [list, total] = await this.employeeRepo.findProjects(employee.id, query)
    return {
      list,
      total,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      totalPage: Math.ceil(total / query.pageSize),
    }
  }

  // 校验项目 ID 并查询当前员工负责的装修订单详情
  async findProject(id: number, user: UserJwtPayload) {
    if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
      throw new BadRequestException('项目 ID 必须是有效的正整数')
    }
    const employee = await this.requireActiveEmployee(user)
    const project = await this.employeeRepo.findProject(id, employee.id)
    if (!project) throw new NotFoundException('该项目不存在')
    return project
  }

  // 校验项目归属和状态后完成装修项目
  async completeProject(id: number, user: UserJwtPayload) {
    const project = await this.findProject(id, user)
    if (project.status === 'COMPLETED') throw new ConflictException('该项目已完成，请勿重复完成')
    if (project.status !== 'IN_SERVICE') throw new ConflictException('当前项目状态不允许完成')
    try {
      // 项目已按当前员工筛选，employeeId 必定存在。
      return await this.employeeRepo.completeProject(id, project.employeeId!)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException('项目状态或归属已变化，请刷新后重试')
      }
      throw error
    }
  }

  // 根据员工 ID 查询员工详情
  async findOne(id: number) {
    // 1. 查询员工档案
    const employee = await this.employeeRepo.findOne(id)
    // 2. 员工不存在时返回 404 异常
    if (!employee) {
      throw new NotFoundException('员工不存在')
    }
    return employee
  }

  // 根据员工 ID 更新员工档案
  async update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    // 1. 检查员工是否存在
    await this.findOne(id)
    try {
      // 2. 更新员工档案
      return await this.employeeRepo.update(id, updateEmployeeDto)
    } catch {
      throw new BadRequestException('员工更新失败，请检查员工编号是否重复')
    }
  }

  // 根据员工 ID 删除员工档案
  async remove(id: number) {
    try {
      // 1. 开启事务，保证员工档案和用户身份同时更新
      return await this.prisma.$transaction(async (tx) => {
        // 2. 查询员工并获取关联用户 ID
        const employee = await this.employeeRepo.findOne(id, tx)
        if (!employee) {
          throw new NotFoundException('员工不存在')
        }

        // 3. 删除员工档案
        const deletedEmployee = await this.employeeRepo.remove(id, tx)

        // 4. 将关联用户的身份恢复为普通用户
        await this.userRepo.updateRoleToCustomer(employee.userId, tx)

        return deletedEmployee
      })
    } catch (error) {
      // 5. 保留员工不存在异常，统一处理数据库异常
      if (error instanceof NotFoundException) throw error
      throw new BadRequestException('员工删除失败，可能存在关联业务数据')
    }
  }

  // 员工创建装修项目
  async CreateProject(createProjectDto: CreateProjectDto, user: UserJwtPayload) {
    // 1.校验员工身份
    const employee = await this.employeeRepo.findByUserId(user.userId)
    if (
      !employee ||
      !employee.status ||
      !employee.user.status ||
      employee.user.role !== 'EMPLOYEE'
    ) {
      throw new ForbiddenException('当前员工账号不可用')
    }

    // 2. 创建项目必须关联后台已发布的标准方案。
    const plan = await this.prisma.renewalPlan.findFirst({
      where: { id: createProjectDto.planId, status: 'PUBLISHED' },
      select: { id: true },
    })
    if (!plan) throw new BadRequestException('标准方案不存在或尚未发布')

    // 3. 预约转项目时，以预约的客户归属为准，并先校验预约负责人。
    const { appointmentId } = createProjectDto
    let userId = createProjectDto.userId ?? null

    if (appointmentId) {
      const appointment = await this.appointmentRepo.findAppointmentForProject(appointmentId)
      if (!appointment) {
        throw new NotFoundException('预约不存在')
      }
      if (appointment.employeeId !== employee.id) {
        throw new ForbiddenException('无权操作该预约')
      }

      const project = await this.renovationProjectRepo.getProjectByAppointmentId(appointmentId)
      if (project) return project

      if (appointment.status !== 'COMPLETED') {
        throw new BadRequestException('请先完成预约服务再创建装修项目')
      }
      if (
        (appointment.type === 'BUDGET' || appointment.type === 'QUOTE') &&
        (!appointment.estimatedAmount || !appointment.estimatedAmount.greaterThan(0))
      ) {
        throw new BadRequestException('请先提交预约预估报价再创建装修项目')
      }

      userId = appointment.userId
    }

    // 4.创建装修项目 + 明细
    const quotedAmount = createProjectDto.quoteItems.reduce(
      (sum, item) =>
        sum.plus(
          new Prisma.Decimal(item.unitPrice).mul(item.quantity),
        ),
      new Prisma.Decimal(0),
    )

    return this.renovationProjectRepo.createRenovationProject({
      projectNo: generateRandomCode(),
      userId,
      employeeId: employee.id,
      quotedAmount,
      appointmentId: createProjectDto.appointmentId,
      planId: createProjectDto.planId,
      name: createProjectDto.name,
      customerName: createProjectDto.customerName,
      mobile: createProjectDto.mobile,
      serviceAddress: createProjectDto.serviceAddress,
      status: 'PENDING_CONFIRM',
      quoteItems: {
        create: createProjectDto.quoteItems.map((item, index) => ({
          ...item,
          sort: index,
        })),
      },
    })
  }
}
