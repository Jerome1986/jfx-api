// 文件说明：收藏控制器，处理用户案例收藏相关 HTTP 请求。
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common'
import { FavoriteService } from './favorite.service'
import { CreateFavoriteDto } from './dto/create-favorite.dto'

@Controller('favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  // 切换用户对指定案例的收藏状态
  @Post('toggle')
  toggleFavorite(@Body() createFavoriteDto: CreateFavoriteDto) {
    return this.favoriteService.toggleFavorite(createFavoriteDto)
  }

  // 获取指定用户的案例收藏列表
  @Get('user/:userId')
  getUserFavorites(@Param('userId', ParseIntPipe) userId: number) {
    return this.favoriteService.getUserFavorites(userId)
  }
}
