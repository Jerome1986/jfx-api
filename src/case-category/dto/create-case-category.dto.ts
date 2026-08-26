// 文件说明：案例分类创建请求的数据传输对象。
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator'

// 新增案例分类请求参数
export class CreateCaseCategoryDto {
  @IsString({ message: '分类名称必须是字符串' })
  @IsNotEmpty({ message: '分类名称不能为空' })
  name: string

  @IsInt({ message: '显示排序必须是整数' })
  @Min(0, { message: '显示排序不能小于0' })
  sort: number
}
