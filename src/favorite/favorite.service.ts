import { Injectable } from '@nestjs/common';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { FavoriteRepository } from './favorite.repository';

@Injectable()
export class FavoriteService {
  constructor(private readonly favoriteRepo: FavoriteRepository) { }

  //收藏列表新增和移除
  async toggleFavorite(createFavoriteDto: CreateFavoriteDto) {
    const { userId, caseId } = createFavoriteDto;
    // 1.查找搜索列表
    const favorite = await this.favoriteRepo.findByUserAndCase(userId, caseId);
    console.log(favorite)
    // 2.存在移除
    if (favorite) {
      await this.favoriteRepo.removeFavorite(userId, caseId);
      return { favorited: false };
    }
    // 3.不存在添加收藏
    const createdFavorite = await this.favoriteRepo.addFavorite(userId, caseId);
    console.log('添加', createdFavorite)
    return { favorited: true, favorite: createdFavorite };
  }
}
