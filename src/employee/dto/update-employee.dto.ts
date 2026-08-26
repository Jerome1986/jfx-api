// 文件说明：员工更新请求的数据传输对象。
import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateEmployeeDto } from './create-employee.dto'

// 员工更新参数：员工编号由后端生成，不允许通过接口修改
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['mobile', 'nickname', 'realName'] as const),
) {}
