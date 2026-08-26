// 文件说明：轮播图数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannerRepository {
  constructor(private prisma: PrismaService) {}

  create(createBannerDto: CreateBannerDto) {
    return this.prisma.banner.create({ data: createBannerDto });
  }

  findAll() {
    return this.prisma.banner.findMany({ orderBy: { sort: 'asc' } });
  }

  findOne(id: number) {
    return this.prisma.banner.findUnique({ where: { id } });
  }

  update(id: number, updateBannerDto: UpdateBannerDto) {
    return this.prisma.banner.update({
      where: { id },
      data: updateBannerDto,
    });
  }

  remove(id: number) {
    return this.prisma.banner.delete({ where: { id } });
  }
}
