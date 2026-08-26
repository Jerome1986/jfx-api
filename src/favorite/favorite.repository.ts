import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'

@Injectable()
export class FavoriteRepository {
  constructor(private prisma: PrismaService) { }

  // 根据用户 ID 和案例 ID 查询收藏记录
  findByUserAndCase(userId: number, caseId: number) {
    return this.prisma.favorite.findUnique({
      where: {
        userId_caseId: {
          userId,
          caseId,
        },
      },
    })
  }

  // 为指定用户新增案例收藏
  addFavorite(userId: number, caseId: number) {
    return this.prisma.favorite.create({
      data: {
        userId,
        caseId,
      },
    })
  }

  // 移除指定用户的案例收藏
  removeFavorite(userId: number, caseId: number) {
    return this.prisma.favorite.delete({
      where: {
        userId_caseId: {
          userId,
          caseId,
        },
      },
    })
  }

  // 根据用户ID获取用户案例收藏列表
  userFavorite(userId: number) {
    return this.prisma.favorite.findMany({
      where: { userId }
    })
  }
}
