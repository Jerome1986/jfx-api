import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { RenovationProjectService } from './renovation-project.service';
import { CreateRenovationProjectDto } from './dto/create-renovation-project.dto';
import { UpdateRenovationProjectDto } from './dto/update-renovation-project.dto';
import { UserJwtGuard } from 'src/common/auth/guards/user-jwt.guard';
import { QueryUserRenovationProjectDto } from './dto/query-user-renovation-project.dto';
import { CurrentUser } from 'src/common/auth/decorators/current-user.decorator';
import type { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface';

@Controller('renovation-project')
export class RenovationProjectController {
  constructor(private readonly renovationProjectService: RenovationProjectService) { }

  @Post()
  create(@Body() createRenovationProjectDto: CreateRenovationProjectDto) {
    return this.renovationProjectService.create(createRenovationProjectDto);
  }

  // 获取指定用户装修列表
  @Get('user')
  @UseGuards(UserJwtGuard)
  findAllByUser(
    @Query() queryDto: QueryUserRenovationProjectDto,
    @CurrentUser() user: UserJwtPayload
  ) {
    return this.renovationProjectService.findAllByUser(queryDto, user)
  }

  // 查找项目详情
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.renovationProjectService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRenovationProjectDto: UpdateRenovationProjectDto) {
    return this.renovationProjectService.update(+id, updateRenovationProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.renovationProjectService.remove(+id);
  }
}
