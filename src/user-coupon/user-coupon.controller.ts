import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserCouponService } from './user-coupon.service';
import { CreateUserCouponDto } from './dto/create-user-coupon.dto';
import { UpdateUserCouponDto } from './dto/update-user-coupon.dto';

@Controller('user-coupon')
export class UserCouponController {
  constructor(private readonly userCouponService: UserCouponService) {}

  @Post()
  create(@Body() createUserCouponDto: CreateUserCouponDto) {
    return this.userCouponService.create(createUserCouponDto);
  }

  @Get()
  findAll() {
    return this.userCouponService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userCouponService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserCouponDto: UpdateUserCouponDto) {
    return this.userCouponService.update(+id, updateUserCouponDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userCouponService.remove(+id);
  }
}
