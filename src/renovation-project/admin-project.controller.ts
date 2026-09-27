import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  PipeTransform,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { CurrentUser } from '../common/auth/decorators/current-user.decorator'
import { RawResponse } from '../common/decorators/raw-response.decorator'
import { AdminProjectGuard } from './admin-project.guard'
import { AdminProjectService } from './admin-project.service'
import {
  AddProjectFollowUpDto,
  AddProjectProgressDto,
  AssignAdminProjectDto,
  ConvertAppointmentDto,
  CreateAdminProjectDto,
  EditAdminProjectDto,
  QueryAdminProjectDto,
  SaveAdminQuotationDto,
} from './dto/admin-project.dto'

export class ProjectIdPipe implements PipeTransform<number, number> {
  // 校验装修项目编号
  transform(id: number) {
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647)
      throw new BadRequestException('ID 必须是有效正整数')
    return id
  }
}

// 封装操作成功响应
const success = async (result: Promise<unknown>) => ({
  code: 200,
  message: '操作成功',
  data: await result,
})

@Controller('project')
@UseGuards(UserJwtGuard, AdminProjectGuard)
@RawResponse()
export class AdminProjectController {
  constructor(private readonly service: AdminProjectService) {}

  // 后台查询装修项目列表
  @Get()
  list(@Query() dto: QueryAdminProjectDto) {
    return success(this.service.list(dto))
  }

  // 后台查询装修项目详情
  @Get(':id')
  detail(@Param('id', ParseIntPipe, ProjectIdPipe) id: number) {
    return success(this.service.detail(id))
  }

  // 后台新增装修项目
  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateAdminProjectDto) {
    return success(this.service.create(dto))
  }

  // 后台更新装修项目信息
  @Patch(':id')
  edit(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: EditAdminProjectDto,
  ) {
    return success(this.service.edit(id, dto))
  }

  // 分配装修项目负责人
  @Patch(':id/assignee')
  assign(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: AssignAdminProjectDto,
  ) {
    return success(this.service.assign(id, dto.employeeId))
  }

  // 保存装修项目报价
  @Put(':id/quotation')
  quotation(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: SaveAdminQuotationDto,
  ) {
    return success(this.service.quotation(id, dto))
  }

  // 新增装修项目进度记录
  @Post(':id/progress')
  @HttpCode(200)
  progress(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: AddProjectProgressDto,
    @CurrentUser() actor: { userId: number },
  ) {
    return success(this.service.progress(id, dto, actor.userId))
  }

  // 新增装修项目跟进记录
  @Post(':id/follow-up')
  @HttpCode(200)
  followUp(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: AddProjectFollowUpDto,
  ) {
    return success(this.service.followUp(id, dto))
  }
}

@Controller('appointment')
@UseGuards(UserJwtGuard, AdminProjectGuard)
@RawResponse()
export class AppointmentProjectController {
  constructor(private readonly service: AdminProjectService) {}

  // 将预约转为装修项目
  @Post(':id/convert')
  @HttpCode(200)
  convert(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: ConvertAppointmentDto,
  ) {
    return success(this.service.convert(id, dto))
  }
}
