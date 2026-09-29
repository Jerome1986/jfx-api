import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { CreateFeedbackDto } from './dto/create-feedback.dto'
import { FeedbackRepository } from './feedback.repository'
import { generateRandomCode } from 'src/utils/random.util'
import { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface'
import { PrismaService } from 'src/prisma/prisma.service'
import { Prisma } from '../../generated/prisma/client'
import { QueryFeedbackDto } from './dto/query-feedback.dto'
import { FeedbackWhereInput } from '../../generated/prisma/models'
import { ReplyFeedbackDto } from './dto/reply-feedback.dto'
import { QueryMyFeedbackDto } from './dto/query-my-feedback.dto'

@Injectable()
export class FeedbackService {
  // 注入 FeedbackRepository、PrismaService，供当前模块的业务校验与流程编排使用。
  constructor(
    private feedbackRepo: FeedbackRepository,
    private prisma: PrismaService,
  ) { }

  // 管理员提交回复
  async reply(id: number, dto: ReplyFeedbackDto, admin: { userId: number; type: string }) {
    // 1. 校验管理员身份和账号状态，回复人从登录凭证获取。
    if (admin.type !== 'admin') throw new ForbiddenException('仅管理员可回复反馈')
    const account = await this.prisma.admin.findUnique({
      where: { id: admin.userId },
      select: { status: true },
    })
    if (!account?.status) throw new ForbiddenException('管理员账号不存在或已禁用')

    // 2. 检查反馈是否存在，已回复、已关闭的反馈不能再次回复。
    const feedback = await this.feedbackRepo.findById(id)
    if (!feedback) throw new NotFoundException('反馈不存在')
    if (feedback.status !== 'PENDING' && feedback.status !== 'PROCESSING') {
      throw new ConflictException('反馈已回复或已关闭，不能重复回复')
    }

    // 3. 保存回复、处理管理员和完成时间；更新时再次校验状态，避免并发覆盖。
    try {
      return await this.feedbackRepo.reply(id, dto.reply, admin.userId)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException('反馈状态已变更，请刷新后重试')
      }
      throw error
    }
  }

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
          if (!account?.status) throw new ForbiddenException('用户不存在或已禁用')

          // 4. 查询当前用户是否有待处理或处理中的反馈，有则返回 409。
          const pending = await this.feedbackRepo.findOneByUser(
            user.userId,
            tx,
          )
          if (pending) throw new ConflictException('您有待处理的反馈，请勿重复提交')

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

  // 根据用户ID查找是否提交过
  async findOneByUser(user: UserJwtPayload) {
    // 1. 校验登录身份：管理员不能通过用户入口提交反馈。
    if (user.type !== 'user') throw new ForbiddenException('仅用户可提交反馈')

    // 2. 检查用户是否存在、账号是否启用。
    const account = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { status: true },
    })
    if (!account?.status) throw new ForbiddenException('用户不存在或已禁用')

    return this.feedbackRepo.findOneByUser(user.userId)
  }

  // 我的反馈记录：校验用户身份，仅查询当前登录用户的数据
  async findMine(queryDto: QueryMyFeedbackDto, user: UserJwtPayload) {
    if (user.type !== 'user') throw new ForbiddenException('仅用户可查询本人的反馈')
    const account = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { status: true },
    })
    if (!account?.status) throw new ForbiddenException('用户不存在或已禁用')

    const { pageNum, pageSize } = queryDto
    const [list, total] = await this.feedbackRepo.findMine(user.userId, pageNum, pageSize)
    return { list, total, pageNum, pageSize, totalPage: Math.ceil(total / pageSize) }
  }

  // 后台管理获取所有意见反馈
  async findAll(queryDto: QueryFeedbackDto) {
    const pageNum = Number(queryDto.pageNum) || 1
    const pageSize = Number(queryDto.pageSize) || 10
    const keyWords = queryDto.keyWords?.trim()
    let where: FeedbackWhereInput = {}
    if (queryDto.status !== 'ALL' && queryDto.status) where.status = queryDto.status
    if (keyWords) {
      // 1.按编号查询
      where.OR = [
        { feedbackNo: { contains: keyWords } },
      ]
      // 2.校验用户，存在则用按用户ID来查询
      const user = await this.prisma.user.findFirst({ where: { mobile: keyWords }, select: { id: true } })
      if (user) where.OR.push({ userId: user.id })
    }

    const [list, total] = await this.feedbackRepo.findAll(where, pageNum, pageSize)

    return {
      list,
      total,
      pageNum,
      pageSize,
      totalPage: Math.ceil(total / pageSize)
    }
  }
}
