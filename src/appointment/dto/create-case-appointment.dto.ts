// 文件说明：案例同款报价预约请求的数据传输对象。
import { Transform, Type } from 'class-transformer'
import { IsInt, Max, Min, ValidateIf } from 'class-validator'

export class CreateCaseAppointmentDto {
  // 需要咨询同款报价的装修案例 ID
  @Type(() => Number)
  @IsInt({ message: '案例ID必须是整数' })
  @Min(1, { message: '案例ID必须大于0' })
  @Max(2147483647, { message: '案例ID超出有效范围' })
  caseId: number

  // 分享员工编号，省略时保持待分配。
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? Number(value) : value)
  @IsInt({ message: '员工ID必须是整数' })
  @Min(1, { message: '员工ID必须大于0' })
  @Max(2147483647, { message: '员工ID超出有效范围' })
  employeeId?: number
}
