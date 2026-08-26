// 文件说明：用户微信手机号登录请求的数据传输对象。
import { IsString } from 'class-validator'

export class WxPhoneLoginDto {
  @IsString()
  code: string
  @IsString()
  phoneCode: string
}