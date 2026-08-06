import { Injectable } from '@nestjs/common';
import { CreateCaseDto } from './dto/create-case.dto';
import { caseRepository } from './case.repository';

@Injectable()
export class CaseService {
  constructor(private caseRepo: caseRepository) { }

  // 新增案例
  async createCase(createCaseDto: CreateCaseDto) {
    const res = await this.caseRepo.createCase(createCaseDto)

    return {
      caseId: res.id
    }
  }

  // 获取所有案例
  async findAllCase(pageNum: number, pageSize: number) {
    const [list, total] = await this.caseRepo.findAllCase(pageNum, pageSize)

    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize),
    }
  }
}
