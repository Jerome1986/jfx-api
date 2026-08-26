// 文件说明：案例模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { caseRepository } from './case.repository';

@Module({
  controllers: [CaseController],
  providers: [CaseService, caseRepository],
})
export class CaseModule { }
