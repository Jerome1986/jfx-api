// 文件说明：收藏业务服务，负责案例收藏业务规则与流程编排。
import { ForbiddenException, Injectable } from '@nestjs/common'
import { CreateFavoriteDto } from './dto/create-favorite.dto'
import { FavoriteRepository } from './favorite.repository'
import type { UserJwtPayload } from '../common/auth/interfaces/user-jwt-payload.interface'

@Injectable()
export class FavoriteService {
  // 注入 FavoriteRepository，供当前模块的业务校验与流程编排使用。
  constructor(private readonly favoriteRepo: FavoriteRepository) {}

  // 根据当前收藏状态新增或取消案例收藏
  async toggleFavorite(createFavoriteDto: CreateFavoriteDto, user: UserJwtPayload) {
    await this.checkUserAccess(createFavoriteDto.userId ?? user.userId, user)
    const { userId } = user
    const { caseId } = createFavoriteDto
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
  async getUserFavorites(userId: number, user: UserJwtPayload) {
    await this.checkUserAccess(userId, user)
    return this.favoriteRepo.getUserFavorites(user.userId)
  }

  // 收藏仅供启用的用户账号访问，禁止查询或修改他人的收藏。
  private async checkUserAccess(userId: number, user: UserJwtPayload) {
    if (user.type !== 'user' || user.userId !== userId) {
      throw new ForbiddenException('仅可访问本人的收藏')
    }
    const account = await this.favoriteRepo.findUser(user.userId)
    if (!account?.status) throw new ForbiddenException('用户账号不存在或已禁用')
  }
}
