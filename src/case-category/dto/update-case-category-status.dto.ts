import { IsBoolean, IsString } from 'class-validator'

// 启用或禁用案例分类请求参数
export class UpdateCaseCategoryStatusDto {
  @IsBoolean()
  isEnabled: boolean
}
