// 文件说明：焕新方案预约请求的数据传输对象。
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'

export class PlanAppointmentSnapshotItemDto {
  @Type(() => Number)
  @IsInt({ message: '来源方案明细ID必须是整数' })
  @Min(1, { message: '来源方案明细ID必须大于0' })
  sourceItemId: number

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '候选项ID必须是整数' })
  @Min(1, { message: '候选项ID必须大于0' })
  candidateId?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '商品ID必须是整数' })
  @Min(1, { message: '商品ID必须大于0' })
  productId?: number | null

  @IsString({ message: '项目分类必须是字符串' })
  @IsNotEmpty({ message: '项目分类不能为空' })
  category: string

  @IsString({ message: '项目名称必须是字符串' })
  @IsNotEmpty({ message: '项目名称不能为空' })
  name: string

  @IsOptional()
  @IsString({ message: '项目描述必须是字符串' })
  description?: string | null

  @IsString({ message: '计价单位必须是字符串' })
  @IsNotEmpty({ message: '计价单位不能为空' })
  unit: string

  @IsString({ message: '单价必须是字符串' })
  @IsNotEmpty({ message: '单价不能为空' })
  unitPrice: string

  @IsString({ message: '数量必须是字符串' })
  @IsNotEmpty({ message: '数量不能为空' })
  quantity: string

  @IsOptional()
  @IsString({ message: '项目图片必须是字符串' })
  image?: string | null
}

export class PlanAppointmentSnapshotDto {
  @IsString({ message: '方案标题必须是字符串' })
  @IsNotEmpty({ message: '方案标题不能为空' })
  title: string

  @IsOptional()
  @IsString({ message: '方案封面必须是字符串' })
  cover?: string | null

  @IsString({ message: '参考价格必须是字符串' })
  @IsNotEmpty({ message: '参考价格不能为空' })
  referencePrice: string

  @IsArray({ message: '预约快照明细必须是数组' })
  @ArrayMinSize(1, { message: '请至少选择一项方案明细' })
  @ValidateNested({ each: true })
  @Type(() => PlanAppointmentSnapshotItemDto)
  items: PlanAppointmentSnapshotItemDto[]
}

export class CreatePlanAppointmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '用户ID必须是整数' })
  @Min(1, { message: '用户ID必须大于0' })
  userId?: number | null

  @Type(() => Number)
  @IsInt({ message: '焕新方案ID必须是整数' })
  @Min(1, { message: '焕新方案ID必须大于0' })
  planId: number

  @IsDefined({ message: '预约快照不能为空' })
  @ValidateNested()
  @Type(() => PlanAppointmentSnapshotDto)
  snapshot: PlanAppointmentSnapshotDto
}
