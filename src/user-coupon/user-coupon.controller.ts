import { Controller, Get, Post, Body } from '@nestjs/common';
import { UserCouponService } from './user-coupon.service';
import { CreateUserCouponDto } from './dto/create-user-coupon.dto';

@Controller('user-coupon')
export class UserCouponController {
  // 注入 UserCouponService，将接口请求交给业务服务处理。
  constructor(private readonly userCouponService: UserCouponService) { }

  // 给指定用户发放优惠券
  @Post('sendUser')
  sendCouponByUser(@Body() createUserCouponDto: CreateUserCouponDto) {
    return this.userCouponService.sendCouponByUser(createUserCouponDto)
  }

  // 查找发放记录
  @Get()
  findAll() {
    return this.userCouponService.findAll()
  }
}
