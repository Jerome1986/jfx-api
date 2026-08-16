import { Injectable } from '@nestjs/common';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BannerRepository } from './banner.repository';

@Injectable()
export class BannerService {
  constructor(private bannerRepository: BannerRepository) {}

  create(createBannerDto: CreateBannerDto) {
    return this.bannerRepository.create(createBannerDto);
  }

  findAll() {
    return this.bannerRepository.findAll();
  }

  findOne(id: number) {
    return this.bannerRepository.findOne(id);
  }

  update(id: number, updateBannerDto: UpdateBannerDto) {
    return this.bannerRepository.update(id, updateBannerDto);
  }

  remove(id: number) {
    return this.bannerRepository.remove(id);
  }
}
