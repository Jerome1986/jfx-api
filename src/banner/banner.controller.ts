// 文件说明：轮播图控制器，处理相关 HTTP 请求。
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Controller('banner')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  // 新增轮播图
  @Post()
  create(@Body() createBannerDto: CreateBannerDto) {
    return this.bannerService.create(createBannerDto);
  }

  // 获取轮播图列表
  @Get()
  findAll() {
    return this.bannerService.findAll();
  }

  // 获取轮播图详情
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannerService.findOne(+id);
  }

  // 更新轮播图
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBannerDto: UpdateBannerDto) {
    return this.bannerService.update(+id, updateBannerDto);
  }

  // 删除轮播图
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bannerService.remove(+id);
  }
}
