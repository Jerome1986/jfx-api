// 文件说明：案例分类状态更新请求的数据传输对象。
import { IsBoolean, IsString } from 'class-validator'

// 启用或禁用案例分类请求参数
export class UpdateCaseCategoryStatusDto {
  @IsBoolean()
  isEnabled: boolean
}
