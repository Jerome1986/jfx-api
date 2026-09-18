import { PickType } from '@nestjs/mapped-types'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { CreateProjectDto } from './create-project.dto'

export class UpdateProjectQuoteDto extends PickType(CreateProjectDto, ['planId', 'quoteItems'] as const) {
  @IsInt()
  @Min(1)
  @Max(2147483646)
  quoteVersion: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  quoteRemark?: string | null
}
