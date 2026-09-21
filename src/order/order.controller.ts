import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UserJwtGuard } from 'src/common/auth/guards/user-jwt.guard';
import { CurrentUser } from 'src/common/auth/decorators/current-user.decorator';
import type { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface';
import { QueryOrderDto } from './dto/query-order.dto';
import { ArrangeInstallationDto } from './dto/arrange-installation.dto';
import { RawResponse } from 'src/common/decorators/raw-response.decorator';
import { AutoCompletionDto } from './dto/auto-completion.dto';
import { QueryAllDto } from './dto/query-all.dto';

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
  ) { }
  // 取消订单
  @Patch(':id/cancel')
  @UseGuards(UserJwtGuard)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserJwtPayload) {
    return this.orderService.cancel(id, user)
  }

  // 确认商品订单并支付
  @Post('confrimOrder')
  @UseGuards(UserJwtGuard)
  confrimOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser('user') user: UserJwtPayload
  ) {
    return this.orderService.confrimOrder(createOrderDto, user)
  }

  // 根据用户ID和订单状态查询订单列表
  @Get('user')
  @UseGuards(UserJwtGuard)
  orderFindAllByUser(
    @Query() queryOrderDto: QueryOrderDto,
    @CurrentUser('user') user: UserJwtPayload
  ) {
    return this.orderService.orderFindAllByUser(queryOrderDto, user)
  }
  @Get('detail/:id')
  @UseGuards(UserJwtGuard)
  findOneByUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserJwtPayload,
  ) {
    return this.orderService.findOneByUser(id, user)
  }

  // 获取所有订单--后台管理
  @Get('all')
  findAll(@Query() query: QueryAllDto) {
    return this.orderService.findAll(query)
  }

  // 后台报完工，订单进入待客户确认，无请求体。
  @Patch(':id/complete')
  @UseGuards(UserJwtGuard)
  @RawResponse()
  completeInstallation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserJwtPayload,
  ) {
    return this.orderService.completeInstallation(id, user)
  }

  // 客户确认自己的订单完成，无请求体。
  @Patch(':id/confirm-completion')
  @UseGuards(UserJwtGuard)
  @RawResponse()
  confirmCompletion(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserJwtPayload,
  ) {
    return this.orderService.confirmCompletion(id, user)
  }

  // 后台在线下争议处理期间暂停或恢复自动完成。
  @Patch(':id/auto-completion')
  @UseGuards(UserJwtGuard)
  @RawResponse()
  setAutoCompletionPaused(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AutoCompletionDto,
    @CurrentUser() user: UserJwtPayload,
  ) {
    return this.orderService.setAutoCompletionPaused(id, dto.paused, user)
  }

  // 安排安装
  @Patch(':id/installation')
  @UseGuards(UserJwtGuard)
  @RawResponse()
  arrangeInstallation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ArrangeInstallationDto,
    @CurrentUser() user: UserJwtPayload,
  ) {
    return this.orderService.arrangeInstallation(id, dto, user)
  }
}
