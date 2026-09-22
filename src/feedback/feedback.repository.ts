import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { FeedbackUncheckedCreateInput } from '../../generated/prisma/models'
import { Prisma } from '../../generated/prisma/client'

@Injectable()
export class FeedbackRepository {
  constructor(private prisma: PrismaService) {}

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
}
