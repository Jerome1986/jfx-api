import { PartialType } from '@nestjs/mapped-types'
import { CreateConstructionServiceDto } from './create-construction-service.dto'

// 更新施工服务参数，所有字段均可选
export class UpdateConstructionServiceDto extends PartialType(
  CreateConstructionServiceDto,
) {}
