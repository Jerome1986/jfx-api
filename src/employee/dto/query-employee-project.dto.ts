import { Type } from 'class-transformer'
import { IsIn, IsInt, Max, Min } from 'class-validator'
import { RenovationProjectStatus } from '../../../generated/prisma/enums'

export class QueryEmployeeProjectDto {
  @IsIn(['ALL', ...Object.values(RenovationProjectStatus)])
  status: RenovationProjectStatus | 'ALL' = 'ALL'

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  pageNum: number = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10
}
