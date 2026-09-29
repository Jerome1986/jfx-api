// 文件说明：轮播图数据仓储，封装数据库访问操作。
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannerRepository {
  // 注入 PrismaService，封装当前模块的数据库访问。
  constructor(private prisma: PrismaService) {}

  // 新增轮播图
  create(createBannerDto: CreateBannerDto) {
    return this.prisma.banner.create({ data: createBannerDto });
  }

  // 获取轮播图列表
  findAll() {
    return this.prisma.banner.findMany({ orderBy: { sort: 'asc' } });
  }

  // 获取轮播图详情
  findOne(id: number) {
    return this.prisma.banner.findUnique({ where: { id } });
  }

  // 更新轮播图
  update(id: number, updateBannerDto: UpdateBannerDto) {
    return this.prisma.banner.update({
      where: { id },
      data: updateBannerDto,
    });
  }

  // 删除轮播图
  remove(id: number) {
    return this.prisma.banner.delete({ where: { id } });
  }
}
