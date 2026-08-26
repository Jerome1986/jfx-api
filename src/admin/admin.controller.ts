// 文件说明：管理员控制器，处理相关 HTTP 请求。
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginAdminDto } from './dto/login-admin.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  // 注册管理员
  @Post('register')
  create(@Body() createAdminDto: CreateAdminDto) {
    console.log('管理员', createAdminDto)
    return this.adminService.create(createAdminDto);
  }

  // 管理员登录
  @Post('login')
  adminLogin(@Body() loginAdminDto: LoginAdminDto) {
    console.log('管理员', loginAdminDto)
    return this.adminService.login(loginAdminDto)
  }
}
