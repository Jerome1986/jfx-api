// 文件说明：案例更新请求的数据传输对象。
import { PartialType } from '@nestjs/mapped-types';
import { CreateCaseDto } from './create-case.dto';

export class UpdateCaseDto extends PartialType(CreateCaseDto) {}
