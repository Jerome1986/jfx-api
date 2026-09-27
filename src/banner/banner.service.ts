// 文件说明：轮播图业务服务，负责业务规则与流程编排。
import { Injectable } from '@nestjs/common';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BannerRepository } from './banner.repository';

@Injectable()
export class BannerService {
  constructor(private bannerRepository: BannerRepository) {}

  // 新增轮播图
  create(createBannerDto: CreateBannerDto) {
    return this.bannerRepository.create(createBannerDto);
  }

  // 获取轮播图列表
  findAll() {
    return this.bannerRepository.findAll();
  }

  // 获取轮播图详情
  findOne(id: number) {
    return this.bannerRepository.findOne(id);
  }

  // 更新轮播图
  update(id: number, updateBannerDto: UpdateBannerDto) {
    return this.bannerRepository.update(id, updateBannerDto);
  }

  // 删除轮播图
  remove(id: number) {
    return this.bannerRepository.remove(id);
  }
}
