// 文件说明：员工控制器，处理相关 HTTP 请求。
import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard';
import { CurrentUser } from '../common/auth/decorators/current-user.decorator';
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { QueryEmployeeProjectDto } from './dto/query-employee-project.dto';

@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) { }

  // 新增员工
  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }

  // 分页查询员工列表
  @Get()
  findAll(@Query() query: QueryEmployeeDto) {
    return this.employeeService.findAll(query);
  }

  // 当前员工工作概览
  @Get('summary')
  @UseGuards(UserJwtGuard)
  summary(@CurrentUser() user: UserJwtPayload) {
    return this.employeeService.summary(user);
  }

  // 当前员工负责的装修订单，静态路由放在 :id 之前。
  @Get('projects')
  @UseGuards(UserJwtGuard)
  findProjects(@Query() query: QueryEmployeeProjectDto, @CurrentUser() user: UserJwtPayload) {
    return this.employeeService.findProjects(query, user);
  }

  // 查询当前员工负责的装修订单详情
  @Get('projects/:id')
  @UseGuards(UserJwtGuard)
  findProject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserJwtPayload) {
    return this.employeeService.findProject(id, user);
  }

  // 员工完成负责的装修项目
  @Patch('projects/:id/complete')
  @UseGuards(UserJwtGuard)
  completeProject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserJwtPayload) {
    return this.employeeService.completeProject(id, user);
  }

  // 查询员工详情
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.findOne(id);
  }

  // 更新员工信息
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeeService.update(id, updateEmployeeDto);
  }

  // 删除员工
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.remove(id);
  }

  // 员工创建装修项目
  @Post('projects')
  @UseGuards(UserJwtGuard)
  CreateProject(@Body() createProjectDto: CreateProjectDto, @CurrentUser() user: UserJwtPayload) {
    return this.employeeService.CreateProject(createProjectDto, user)
  }
}
