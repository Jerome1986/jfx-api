// 文件说明：确认预约上门信息的请求数据传输对象。
import { Transform } from 'class-transformer'
import { IsDateString, IsNotEmpty, IsString } from 'class-validator'

/** 确认上门时提交的日期、时间段和详细地址。 */
export class ConfirmVisitDto {
  /** 上门日期，使用 ISO 8601 格式，例如 2026-09-10。 */
  @IsString({ message: '上门日期必须是字符串' })
  @IsNotEmpty({ message: '上门日期不能为空' })
  @IsDateString({ strict: true }, { message: '上门日期必须是有效的 ISO 8601 日期' })
  visitDate: string

  /** 上门时间段，例如 09:00-12:00。 */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '上门时间段必须是字符串' })
  @IsNotEmpty({ message: '上门时间段不能为空' })
  timeSlot: string

  /** 上门详细地址，包含小区、楼栋及门牌号等信息。 */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '上门地址必须是字符串' })
  @IsNotEmpty({ message: '上门地址不能为空' })
  visitAddress: string
}
