import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { CreateFeedbackDto } from './dto/create-feedback.dto'
import { UpdateFeedbackDto } from './dto/update-feedback.dto'
import { FeedbackRepository } from './feedback.repository'
import { generateRandomCode } from 'src/utils/random.util'
import { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface'
import { PrismaService } from 'src/prisma/prisma.service'
import { Prisma } from '../../generated/prisma/client'

@Injectable()
export class FeedbackService {
  constructor(
    private feedbackRepo: FeedbackRepository,
    private prisma: PrismaService,
  ) { }

  // 用户提交建议
  async create(createFeedbackDto: CreateFeedbackDto, user: UserJwtPayload) {
    // 1. 校验登录身份：管理员不能通过用户入口提交反馈。
    if (user.type !== 'user') throw new ForbiddenException('仅用户可提交反馈')

    // 2. 开启事务：下面的校验、查重和新增共用 tx，失败时回滚。
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 3. 检查用户是否存在、账号是否启用。
          const account = await tx.user.findUnique({
            where: { id: user.userId },
            select: { status: true },
          })
          if (!account?.status)
            throw new ForbiddenException('用户不存在或已禁用')

          // 4. 查询当前用户是否有待处理或处理中的反馈，有则返回 409。
          const pending = await this.feedbackRepo.findOneByUser(
            user.userId,
            tx,
          )
          if (pending)
            throw new ConflictException('您有待处理的反馈，请勿重复提交')

          // 5. 校验通过后生成反馈编号并新增；主键自增，状态默认待处理。
          // 回调成功后事务提交，接口返回新增记录。
          return this.feedbackRepo.create(
            {
              feedbackNo: generateRandomCode(),
              userId: user.userId,
              type: createFeedbackDto.type,
              content: createFeedbackDto.content,
            },
            tx,
          )
        },
        // 使用可串行化隔离级别，避免并发请求都通过查重并成功新增。
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      // 6. 区分异常：P2034 表示事务写冲突或死锁，其他异常原样抛出。
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034'
      ) {
        throw error
      }
      // 并发冲突直接返回 409，提示重试，不自动循环提交。
      throw new ConflictException('提交冲突，请稍后重试')
    }
  }

  findAll() {
    return `This action returns all feedback`
  }

  findOne(id: number) {
    return `This action returns a #${id} feedback`
  }

  update(id: number, updateFeedbackDto: UpdateFeedbackDto) {
    return `This action updates a #${id} feedback`
  }

  remove(id: number) {
    return `This action removes a #${id} feedback`
  }
}
