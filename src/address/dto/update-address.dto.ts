// 文件说明：地址更新请求的数据传输对象。
import { PartialType } from '@nestjs/mapped-types';
import { CreateAddressDto } from './create-address.dto';

// 更新地址，所有字段均为可选
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
