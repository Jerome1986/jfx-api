import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { BannerController } from './banner.controller';
import { BannerRepository } from './banner.repository';

@Module({
  controllers: [BannerController],
  providers: [BannerService, BannerRepository],
})
export class BannerModule {}
