// 文件说明：收藏控制器，处理用户案例收藏相关 HTTP 请求。
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import { FavoriteService } from './favorite.service'
import { CreateFavoriteDto } from './dto/create-favorite.dto'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { CurrentUser } from '../common/auth/decorators/current-user.decorator'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'

@Controller('favorite')
@UseGuards(UserJwtGuard)
export class FavoriteController {
  // 注入 FavoriteService，将接口请求交给业务服务处理。
  constructor(private readonly favoriteService: FavoriteService) {}

  // 切换用户对指定案例的收藏状态
  @Post('toggle')
  toggleFavorite(@Body() createFavoriteDto: CreateFavoriteDto, @CurrentUser() user: UserJwtPayload) {
    return this.favoriteService.toggleFavorite(createFavoriteDto, user)
  }

  // 获取指定用户的案例收藏列表
  @Get('user/:userId')
  getUserFavorites(@Param('userId', ParseIntPipe) userId: number, @CurrentUser() user: UserJwtPayload) {
    return this.favoriteService.getUserFavorites(userId, user)
  }
}
