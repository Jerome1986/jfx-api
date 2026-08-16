import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeRepository } from './employee.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { UserRepository } from 'src/user/user.repository';
import { Prisma } from '../../generated/prisma/browser';
import { generateRandomCode } from 'src/utils/random.util';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly employeeRepo: EmployeeRepository,
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
  ) { }

  // 新增员工：处理用户注册、身份变更和员工档案创建
  async create(createEmployeeDto: CreateEmployeeDto) {
    // 1. 拆分用户账号信息和员工档案信息
    const {
      userId,
      mobile,
      nickname,
      realName,
      hiredAt,
      ...employeeData
    } = createEmployeeDto

    try {
      // 2. 开启事务，保证用户和员工数据同时成功或同时回滚
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 3. 检查该用户是否已经存在员工档案
        const existingEmployee = await this.employeeRepo.findByUserId(userId, tx)
        if (existingEmployee) {
          throw new BadRequestException('该用户已经是员工')
        }

        // 4. 根据用户 ID 查询用户是否已经注册
        const user = await this.userRepo.findById(userId, tx)

        if (user) {
          // 5.1 用户已注册，直接将用户身份修改为员工
          await this.userRepo.updateRoleToEmployee(userId, tx)
        } else {
          // 5.2 用户未注册，校验注册所需的手机号
          if (!mobile) {
            throw new BadRequestException('用户未注册，手机号不能为空')
          }

          // 5.3 创建新用户，并直接设置为员工身份
          await this.userRepo.createEmployeeUser(
            {
              id: userId,
              mobile,
              nickname,
              realName,
            },
            tx,
          )
        }

        // 6. 后端生成唯一员工编号并创建员工档案
        return this.employeeRepo.create(
          {
            ...employeeData,
            userId,
            employeeNo: generateRandomCode(),
            hiredAt: hiredAt ? new Date(hiredAt) : undefined,
          },
          tx,
        )
      })
    } catch (error) {
      // 7. 保留主动抛出的业务异常，统一处理数据库异常
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
}
