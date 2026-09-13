import { IsEnum, IsOptional, IsString } from "class-validator"

export enum ProjectStatus {
  ALL = 'ALL',
  PENDING_CONFIRM = 'PENDING_CONFIRM',
  IN_SERVICE = 'IN_SERVICE',
  COMPLETED = 'COMPLETED',
}

export class QueryUserRenovationProjectDto {
  @IsEnum(ProjectStatus)
  status: ProjectStatus

  @IsOptional()
  @IsString()
  pageNum?: string

  @IsOptional()
  @IsString()
  pageSize?: string
}