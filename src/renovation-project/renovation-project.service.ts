import { Injectable } from '@nestjs/common';
import { CreateRenovationProjectDto } from './dto/create-renovation-project.dto';
import { UpdateRenovationProjectDto } from './dto/update-renovation-project.dto';
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
  findOne(id: number) {
    return this.renovationProjectRepo.findOne(id)
  }

  update(id: number, updateRenovationProjectDto: UpdateRenovationProjectDto) {
    return `This action updates a #${id} renovationProject`;
  }

  remove(id: number) {
    return `This action removes a #${id} renovationProject`;
  }
}
