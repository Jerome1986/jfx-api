// 文件说明：管理员业务服务，负责业务规则与流程编排。
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminRepository } from './admin.repository';
import * as bcrypt from 'bcrypt'
import { LoginAdminDto } from './dto/login-admin.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminService {
  constructor(
    private adminRepo: AdminRepository,
    private jwtService: JwtService
  ) { }

  // 注册管理员
  async create(createAdminDto: CreateAdminDto) {
    const username = createAdminDto.username
    const password = createAdminDto.password
    // 1.检测管理员账号
    const checkRes = await this.adminRepo.findOneAdmin(username)
    if (checkRes) {
      throw new BadRequestException('用户名已存在')
    }
    // 2.加密密码
    const hashPassword = await bcrypt.hash(password, 10)
    const admin = await this.adminRepo.createAdmin(username, hashPassword)

    return {
      id: admin.id,
      username: admin.username,
      status: admin.status,
      createdAt: admin.createdAt
    }
  }

  // 管理员登录
  async login(loginDto: LoginAdminDto) {
    const { username, password } = loginDto

    //1.查用户
    const admin = await this.adminRepo.findOneAdmin(username)

    if (!admin) {
      throw new BadRequestException('账号不存在')
    }

    //2.校验密码
    const isMatch = await bcrypt.compare(password, admin.password)
    if (!isMatch) {
      throw new BadRequestException('密码错误')
    }

    //3.生成 token
    const token = this.jwtService.sign({
      userId: admin.id,
      username: admin.username,
      role: admin.role,
      type: 'admin'
    })

    // 3️⃣ 返回数据
    return {
      token,
      userInfo: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    }
  }
}
