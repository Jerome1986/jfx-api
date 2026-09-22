import { Module } from '@nestjs/common';
import { RenovationProjectService } from './renovation-project.service';
import { RenovationProjectController } from './renovation-project.controller';
import { RenovationProjectRepository } from './renovation-project.repository';
import { AdminProjectController, AppointmentProjectController } from './admin-project.controller';
import { AdminProjectService } from './admin-project.service';
import { AdminProjectGuard } from './admin-project.guard';
import { AuthModule } from 'src/common/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RenovationProjectController, AdminProjectController, AppointmentProjectController],
  providers: [RenovationProjectService, RenovationProjectRepository, AdminProjectService, AdminProjectGuard],
})
export class RenovationProjectModule { }
