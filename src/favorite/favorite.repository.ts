import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'

@Injectable()
export class FavoriteRepository {
  constructor(private prisma: PrismaService) { }

  // 查询用户与案例之间的收藏记录
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

  // 新增用户案例收藏记录
  addFavorite(userId: number, caseId: number) {
    return this.prisma.favorite.create({
      data: {
        userId,
        caseId,
      },
    })
  }

  // 删除用户案例收藏记录
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

  // 查询指定用户的案例收藏及案例详情
  getUserFavorites(userId: number) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { case: true },
      orderBy: { createdAt: 'desc' },
    })
  }
}
