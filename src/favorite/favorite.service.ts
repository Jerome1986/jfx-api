// 文件说明：收藏业务服务，负责案例收藏业务规则与流程编排。
import { Injectable } from '@nestjs/common'
import { CreateFavoriteDto } from './dto/create-favorite.dto'
import { FavoriteRepository } from './favorite.repository'

@Injectable()
export class FavoriteService {
  constructor(private readonly favoriteRepo: FavoriteRepository) {}

  // 根据当前收藏状态新增或取消案例收藏
  async toggleFavorite(createFavoriteDto: CreateFavoriteDto) {
    const { userId, caseId } = createFavoriteDto
    // 1.查找搜索列表
    const favorite = await this.favoriteRepo.findByUserAndCase(userId, caseId)
    // 2.存在移除
    if (favorite) {
      await this.favoriteRepo.removeFavorite(userId, caseId)
      return { favorited: false }
    }
    // 3.不存在添加收藏
    const createdFavorite = await this.favoriteRepo.addFavorite(userId, caseId)
    return { favorited: true, favorite: createdFavorite }
  }

  // 查询指定用户的案例收藏列表
  getUserFavorites(userId: number) {
    return this.favoriteRepo.getUserFavorites(userId)
  }
}
