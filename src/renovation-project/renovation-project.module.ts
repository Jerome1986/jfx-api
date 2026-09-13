import { Module } from '@nestjs/common';
import { RenovationProjectService } from './renovation-project.service';
import { RenovationProjectController } from './renovation-project.controller';
import { RenovationProjectRepository } from './renovation-project.repository';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/common/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RenovationProjectController],
  providers: [RenovationProjectService, RenovationProjectRepository],
})
export class RenovationProjectModule { }
