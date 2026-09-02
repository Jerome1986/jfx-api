// 文件说明：小程序端按城市查询服务网点的请求参数。
import { Type } from 'class-transformer'
import { IsInt, IsString, Min } from 'class-validator'

export class QueryServiceOutletByCityDto {
  @IsString()
  cityId: string
}
