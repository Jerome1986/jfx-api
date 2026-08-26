// 文件说明：案例搜索查询请求的数据传输对象。
import { Type, Transform } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { PublishStatus } from '../../../generated/prisma/enums'

export class SearchCaseQueryDto {
  @IsOptional()
  @IsString({ message: '案例标题必须是字符串' })
  title?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '案例分类ID必须是整数' })
  @Min(1, { message: '案例分类ID必须大于0' })
  categoryId?: number

  @IsOptional()
  @IsString({ message: '城市必须是字符串' })
  city?: string

  @IsOptional()
  @IsEnum(PublishStatus, {
    message: '发布状态只能是DRAFT、PUBLISHED或OFFLINE',
  })
  status?: PublishStatus

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean({ message: '是否首页推荐必须是true或false' })
  isRecommended?: boolean

  @Type(() => Number)
  @IsInt({ message: '当前页码必须是整数' })
  @Min(1, { message: '当前页码必须大于0' })
  pageNum: number

  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量必须大于0' })
  pageSize: number
}
