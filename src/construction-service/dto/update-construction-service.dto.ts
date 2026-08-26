// 文件说明：施工服务更新请求的数据传输对象。
import { PartialType } from '@nestjs/mapped-types'
import { CreateConstructionServiceDto } from './create-construction-service.dto'

// 更新施工服务参数，所有字段均可选
export class UpdateConstructionServiceDto extends PartialType(
  CreateConstructionServiceDto,
) {}
