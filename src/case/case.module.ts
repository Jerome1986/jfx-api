import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { caseRepository } from './case.repository';

@Module({
  controllers: [CaseController],
  providers: [CaseService, caseRepository],
})
export class CaseModule { }
