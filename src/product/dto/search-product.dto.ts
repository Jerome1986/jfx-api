import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class SearchProductDto {
  @IsNotEmpty({ message: '搜索内容为空' })
  @IsString()
  productName: string

  @IsOptional()
  @IsString()
  pageNum?: string

  @IsOptional()
  @IsString()
  pageSize?: string
}