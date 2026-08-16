import { PartialType } from '@nestjs/mapped-types';
import { CreateAddressDto } from './create-address.dto';

// 更新地址，所有字段均为可选
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
