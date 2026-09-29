import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { QueryCouponDto } from './dto/query-coupon.dto';

@Controller('coupon')
export class CouponController {
  // 注入 CouponService，将接口请求交给业务服务处理。
  constructor(private readonly couponService: CouponService) { }

  // 新建优惠券模板
  @Post('add')
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponService.create(createCouponDto)
  }

  // 获取优惠券列表
  @Get()
  findAll(@Query() query: QueryCouponDto) {
    return this.couponService.findAll(query);
  }

  // 获取优惠券详情
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.couponService.findOne(+id);
  }

  // 更新优惠券
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCouponDto: UpdateCouponDto) {
    return this.couponService.update(+id, updateCouponDto)
  }

  // 删除优惠券
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.couponService.remove(id);
  }
}
