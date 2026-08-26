// 文件说明：案例查询请求的数据传输对象。
import { IsNumberString, IsOptional, IsString } from "class-validator";

export class QueryCase {
  @IsString()
  pageNum: string

  @IsString()
  pageSize: string

  @IsOptional()
  @IsNumberString()
  userId?: string
}
