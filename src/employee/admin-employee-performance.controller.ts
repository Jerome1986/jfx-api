import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { AdminEmployeePerformanceGuard } from './admin-employee-performance.guard'
import { AdminEmployeePerformanceService } from './admin-employee-performance.service'
import { QueryAdminEmployeePerformanceDto } from './dto/query-admin-employee-performance.dto'

@Controller('admin/employee/performance')
@UseGuards(UserJwtGuard, AdminEmployeePerformanceGuard)
export class AdminEmployeePerformanceController {
  constructor(private readonly service: AdminEmployeePerformanceService) {}

  // 后台分页查询所有员工业绩，使用全局响应包装。
  @Get()
  list(@Query() query: QueryAdminEmployeePerformanceDto) {
    return this.service.list(query)
  }
}
