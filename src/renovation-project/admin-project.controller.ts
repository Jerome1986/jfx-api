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
  transform(id: number) {
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647)
      throw new BadRequestException('ID 必须是有效正整数')
    return id
  }
}

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

  @Get()
  list(@Query() dto: QueryAdminProjectDto) {
    return success(this.service.list(dto))
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe, ProjectIdPipe) id: number) {
    return success(this.service.detail(id))
  }

  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateAdminProjectDto) {
    return success(this.service.create(dto))
  }

  @Patch(':id')
  edit(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: EditAdminProjectDto,
  ) {
    return success(this.service.edit(id, dto))
  }

  @Patch(':id/assignee')
  assign(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: AssignAdminProjectDto,
  ) {
    return success(this.service.assign(id, dto.employeeId))
  }

  @Put(':id/quotation')
  quotation(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: SaveAdminQuotationDto,
  ) {
    return success(this.service.quotation(id, dto))
  }

  @Post(':id/progress')
  @HttpCode(200)
  progress(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: AddProjectProgressDto,
    @CurrentUser() actor: { userId: number },
  ) {
    return success(this.service.progress(id, dto, actor.userId))
  }

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

  @Post(':id/convert')
  @HttpCode(200)
  convert(
    @Param('id', ParseIntPipe, ProjectIdPipe) id: number,
    @Body() dto: ConvertAppointmentDto,
  ) {
    return success(this.service.convert(id, dto))
  }
}
