// 文件说明：轮播图更新请求的数据传输对象。
import { PartialType } from '@nestjs/mapped-types';
import { CreateBannerDto } from './create-banner.dto';

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
