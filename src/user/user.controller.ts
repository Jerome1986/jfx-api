// 文件说明：用户控制器，处理相关 HTTP 请求。
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { WxPhoneLoginDto } from './dto/wx-phone-login.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserJwtGuard } from 'src/common/auth/guards/user-jwt.guard';
import { CurrentUser } from 'src/common/auth/decorators/current-user.decorator';
import type { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface';
import { QueryScoreDto } from './dto/query-score-dto';

// 测试登录接口参数类型
export type TestRole = 'CUSTOMER' | 'EMPLOYEE'

@Controller('user')
export class UserController {
  // 注入 UserService，将接口请求交给业务服务处理。
  constructor(private readonly userService: UserService) { }

  // 前端用户微信手机号登录
  @Post('wx-phone-login')
  wxPhoneLogin(@Body() dto: WxPhoneLoginDto) {
    return this.userService.wxPhoneLogin(dto)
  }

  // 用户列表
  @Get()
  findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query)
  }

  // 获取用户积分明细
  @Get('pointRecord')
  @UseGuards(UserJwtGuard)
  scoreFlow(@Query() queryDto: QueryScoreDto, @CurrentUser('user') user: UserJwtPayload) {
    return this.userService.scoreFlow(queryDto, user)
  }

  // 用户积分统计
  @Get('scoreSummary')
  @UseGuards(UserJwtGuard)
  scoreSummary(@CurrentUser('user') user: UserJwtPayload) {
    return this.userService.scoreSummary(user)
  }

  // 用户详情
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id)
  }

  // 更新用户
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(+id, updateUserDto)
  }

  // 逻辑删除用户
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id)
  }

  // 用户数据汇总
  @Get('summary/:userId')
  summary(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.summary(userId)
  }

  // 开发测试登录
  @Post('dev-login')
  testLogin(@Body('role') role: TestRole) {
    return this.userService.testLogin(role)
  }
}
