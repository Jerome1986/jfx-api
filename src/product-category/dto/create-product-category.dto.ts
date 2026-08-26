// 文件说明：产品分类创建请求的数据传输对象。
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class CreateProductCategoryDto {
  @IsOptional()
  @IsInt({ message: '父分类ID必须是整数' })
  @Min(1, { message: '父分类ID必须大于0' })
  parentId?: number

  @IsString({ message: '分类名称必须是字符串' })
  @IsNotEmpty({ message: '分类名称不能为空' })
  name: string

  @IsOptional()
  @IsInt({ message: '排序值必须是整数' })
  @Min(0, { message: '排序值不能小于0' })
  sort?: number

  @IsOptional()
  @IsBoolean({ message: '是否启用必须是布尔值' })
  isEnabled?: boolean
}
