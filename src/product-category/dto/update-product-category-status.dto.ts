import { IsBoolean } from 'class-validator'

export class UpdateProductCategoryStatusDto {
  @IsBoolean({ message: '是否启用必须是布尔值' })
  isEnabled: boolean
}
