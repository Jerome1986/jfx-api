import { IsString } from "class-validator";

export class QueryCase {
  @IsString()
  pageNum: string

  @IsString()
  pageSize: string
}