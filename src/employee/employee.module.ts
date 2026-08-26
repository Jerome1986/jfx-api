// 文件说明：员工模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { EmployeeRepository } from './employee.repository';
import { UserModule } from 'src/user/user.module';

// 注册员工模块的控制器、业务服务和数据仓库
@Module({
  imports: [UserModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}
