import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { FeedbackUncheckedCreateInput, FeedbackWhereInput } from '../../generated/prisma/models'
import { Prisma } from '../../generated/prisma/client'

@Injectable()
export class FeedbackRepository {
  constructor(private prisma: PrismaService) { }

  // 根据 ID 查询意见反馈
  findById(id: number) {
    return this.prisma.feedback.findUnique({ where: { id } })
  }

  // 仅更新未完成的反馈，防止重复回复覆盖原记录
  reply(id: number, reply: string, adminId: number) {
    return this.prisma.feedback.update({
      where: { id, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { reply, adminId, status: 'REPLIED', completedAt: new Date() },
    })
  }

  // 用户提交建议
  create(data: FeedbackUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.feedback.create({
      data,
    })
  }

  // 根据用户ID查找是否提交过
  findOneByUser(userId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    return db.feedback.findFirst({
      where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
    })
  }

  // 我的反馈记录：不限制状态，只返回本人反馈及回复展示所需字段
  findMine(userId: number, pageNum: number, pageSize: number) {
    const where = { userId }
    return Promise.all([
      this.prisma.feedback.findMany({
        where,
        select: {
          id: true,
          feedbackNo: true,
          type: true,
          content: true,
          status: true,
          reply: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.feedback.count({ where }),
    ])
  }

  // 后台管理获取所有意见反馈
  async findAll(where: FeedbackWhereInput, pageNum: number, pageSize: number) {
    return await Promise.all([
      this.prisma.feedback.findMany({
        where,
        include: {
          user: {
            select: {
              mobile: true,
              nickname: true,
              realName: true
            }
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (pageNum - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.feedback.count({ where })
    ])
  }
}
