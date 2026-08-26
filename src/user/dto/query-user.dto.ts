// 文件说明：用户查询请求的数据传输对象。
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { UserRole } from '../../../generated/prisma/enums'

export class QueryUserDto {
  @Type(() => Number)
  @IsInt({ message: '当前页码必须是整数' })
  @Min(1, { message: '当前页码必须大于0' })
  pageNum: number

  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量必须大于0' })
  pageSize: number

  @IsOptional()
  @IsString({ message: '搜索关键字必须是字符串' })
  keyword?: string

  @IsOptional()
  @IsEnum(UserRole, { message: '用户角色只能是CUSTOMER或EMPLOYEE' })
  role?: UserRole

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean({ message: '用户状态必须是true或false' })
  status?: boolean
}
