// 文件说明：产品分类状态更新请求的数据传输对象。
import { IsBoolean } from 'class-validator'

export class UpdateProductCategoryStatusDto {
  @IsBoolean({ message: '是否启用必须是布尔值' })
  isEnabled: boolean
}
