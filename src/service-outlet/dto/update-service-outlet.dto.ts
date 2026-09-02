// 文件说明：更新服务网点请求的数据传输对象。
import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceOutletDto } from './create-service-outlet.dto';

// 继承新增参数校验，并将全部字段转换为可选字段
export class UpdateServiceOutletDto extends PartialType(CreateServiceOutletDto) {}
