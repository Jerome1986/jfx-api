// 文件说明：员工查询请求的数据传输对象。
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class QueryEmployeeDto {
  // 当前页码
  @Type(() => Number)
  @IsInt({ message: '当前页码必须是整数' })
  @Min(1, { message: '当前页码必须大于0' })
  pageNum: number

  // 每页记录数
  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量必须大于0' })
  pageSize: number

  // 员工编号、岗位、姓名或手机号搜索关键字
  @IsOptional()
  @IsString({ message: '搜索关键字必须是字符串' })
  keyword?: string

  // 所属部门筛选
  @IsOptional()
  @IsString({ message: '部门必须是字符串' })
  department?: string

  // 员工状态筛选
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean({ message: '员工状态必须是true或false' })
  status?: boolean
}
