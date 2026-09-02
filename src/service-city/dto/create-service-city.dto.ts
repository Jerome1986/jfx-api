import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateServiceCityDto {
  @IsString({ message: '城市名称必须是字符串' })
  @IsNotEmpty({ message: '城市名称不能为空' })
  @MaxLength(50, { message: '城市名称不能超过50个字符' })
  name: string

  @IsOptional()
  @IsInt({ message: '排序值必须是整数' })
  @Min(0, { message: '排序值不能小于0' })
  sort?: number

  @IsOptional()
  @IsBoolean({ message: '城市状态必须是布尔值' })
  status?: boolean
}
