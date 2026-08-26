// 文件说明：管理员登录请求的数据传输对象。
import { IsString, IsNotEmpty, Length } from 'class-validator'

export class LoginAdminDto {
  @IsString({ message: '用户名必须是字符串' })
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string

  @IsString({ message: '密码必须是字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  password: string
}