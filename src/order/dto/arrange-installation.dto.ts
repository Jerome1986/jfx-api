import { Transform } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class ArrangeInstallationDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '安装人员或团队名称不能为空' })
  @MaxLength(100)
  installerName: string

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '联系电话不能为空' })
  @MaxLength(32)
  installerPhone: string

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remark?: string
}
