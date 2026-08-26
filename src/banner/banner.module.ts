// 文件说明：轮播图模块，组织控制器及相关依赖。
import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { BannerController } from './banner.controller';
import { BannerRepository } from './banner.repository';

@Module({
  controllers: [BannerController],
  providers: [BannerService, BannerRepository],
})
export class BannerModule {}
