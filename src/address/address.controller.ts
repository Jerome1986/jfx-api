// 文件说明：地址控制器，处理相关 HTTP 请求。
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AddressService, type AddressActor } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard';
import { CurrentUser } from '../common/auth/decorators/current-user.decorator';

@Controller('address')
@UseGuards(UserJwtGuard)
export class AddressController {
  // 注入 AddressService，将接口请求交给业务服务处理。
  constructor(private readonly addressService: AddressService) {}

  // 新增地址
  @Post()
  create(@Body() createAddressDto: CreateAddressDto, @CurrentUser() user: AddressActor) {
    return this.addressService.create(createAddressDto, user);
  }

  // 获取地址列表
  @Get()
  findAll(@CurrentUser() user: AddressActor) {
    return this.addressService.findAll(user);
  }

  // 获取地址详情
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AddressActor) {
    return this.addressService.findOne(id, user);
  }

  // 更新地址
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAddressDto: UpdateAddressDto,
    @CurrentUser() user: AddressActor,
  ) {
    return this.addressService.update(id, updateAddressDto, user);
  }

  // 删除地址
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AddressActor) {
    return this.addressService.remove(id, user);
  }
}

