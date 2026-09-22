import { Transform, Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMobilePhone,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  IsISO8601,
} from 'class-validator'
import { OmitType, PartialType, PickType } from '@nestjs/mapped-types'
import { RenovationProjectStatus } from '../../../generated/prisma/enums'
import { CreateProjectQuoteItemDto } from '../../employee/dto/create-project.dto'

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value

export class QueryAdminProjectDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pageNum = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  keyword?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  owner?: string

  @IsIn(['ALL', ...Object.values(RenovationProjectStatus)])
  status: RenovationProjectStatus | 'ALL' = 'ALL'
}

export class CreateAdminProjectDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  name: string

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  customerName: string

  @IsMobilePhone('zh-CN')
  mobile: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId?: number | null

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  employeeId?: number | null

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  planId?: number | null

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  serviceAddress?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  remark?: string
}

export class EditAdminProjectDto extends PartialType(
  PickType(CreateAdminProjectDto, [
    'name',
    'customerName',
    'mobile',
    'serviceAddress',
    'remark',
  ] as const),
  { skipNullProperties: false },
) {}

export class AssignAdminProjectDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  employeeId: number
}

export class ConvertAppointmentDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  projectName: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  remark?: string
}

export class AdminQuoteItemDto extends OmitType(CreateProjectQuoteItemDto, [
  'productId',
  'category',
  'name',
  'unit',
] as const) {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  declare productId?: number | null

  @IsIn(['主材', '人工', '辅材'])
  declare category: string

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  declare name: string

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  declare unit: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  sort?: number
}

export class SaveAdminQuotationDto {
  @IsInt()
  @Min(1)
  @Max(2147483646)
  quoteVersion: number

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdminQuoteItemDto)
  items: AdminQuoteItemDto[]
}

export class AddProjectProgressDto {
  @IsIn(['PENDING_CONFIRM', 'IN_SERVICE', 'COMPLETED'])
  status: 'PENDING_CONFIRM' | 'IN_SERVICE' | 'COMPLETED'

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483646)
  quoteVersion?: number

  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
  contractAmount?: string
}

export class AddProjectFollowUpDto extends AssignAdminProjectDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string

  @IsOptional()
  @IsISO8601({ strict: true })
  nextFollowAt?: string | null
}
