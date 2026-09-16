import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRenovationProjectDto } from './dto/create-renovation-project.dto';
import { Prisma } from '../../generated/prisma/client';
import { RenovationProjectRepository } from './renovation-project.repository';
import { ProjectStatus, QueryUserRenovationProjectDto } from './dto/query-user-renovation-project.dto';
import { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface';

@Injectable()
export class RenovationProjectService {
  constructor(
    private renovationProjectRepo: RenovationProjectRepository
  ) { }

  create(createRenovationProjectDto: CreateRenovationProjectDto) {
    return 'This action adds a new renovationProject';
  }

  // 获取指定用户装修项目列表
  async findAllByUser(queryDto: QueryUserRenovationProjectDto, user: UserJwtPayload) {
    // 1.处理参数
    const status = queryDto.status ?? ProjectStatus.ALL
    const pageNum = Number(queryDto.pageNum) || 1
    const pageSize = Number(queryDto.pageSize) || 10
    const userId = user.userId

    // 2.请求数据库并返回
    const [list, total] = await this.renovationProjectRepo.findAllByUser(userId, status, pageNum, pageSize)

    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize)
    }
  }

  // 查找项目详情
  async findOne(id: number, user: UserJwtPayload) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('项目 ID 必须是正整数')
    }
    const project = await this.renovationProjectRepo.findOne(id, user.userId)
    if (!project) throw new NotFoundException('该项目不存在')
    return project
  }

  // 用户确认报价开始装修服务
  async confirmProject(id: number, user: UserJwtPayload) {
    const project = await this.findOne(id, user)
    if (project.status === 'IN_SERVICE') throw new ConflictException('该项目已确认，请勿重复确认')
    if (project.status !== 'PENDING_CONFIRM') throw new ConflictException('当前项目状态不允许确认')
    try {
      return await this.renovationProjectRepo.confirmProject(id, user.userId, project)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException('项目状态或报价已变化，请刷新后重新确认')
      }
      throw error
    }
  }

  remove(id: number) {
    return `This action removes a #${id} renovationProject`;
  }
}
