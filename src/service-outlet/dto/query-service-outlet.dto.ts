// 文件说明：服务网点分页及条件查询请求的数据传输对象。
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class QueryServiceOutletDto {
  // 当前页码，从 1 开始
  @Type(() => Number)
  @IsInt({ message: '当前页码必须是整数' })
  @Min(1, { message: '当前页码必须大于0' })
  pageNum: number

  // 每页记录数
  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量必须大于0' })
  pageSize: number

  // 网点名称、详细地址或联系电话搜索关键字
  @IsOptional()
  @IsString({ message: '搜索关键字必须是字符串' })
  keyword?: string

  // 服务城市 ID 精确筛选条件
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '城市ID必须是整数' })
  @Min(1, { message: '城市ID必须大于0' })
  cityId?: number

  // 区县精确筛选条件
  @IsOptional()
  @IsString({ message: '区县必须是字符串' })
  district?: string

  // 启用状态筛选条件
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean({ message: '网点状态必须是true或false' })
  status?: boolean
}
