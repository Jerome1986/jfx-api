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
} from '@nestjs/common';
import { UserService } from './user.service';
import { WxPhoneLoginDto } from './dto/wx-phone-login.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UserController {
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
}
