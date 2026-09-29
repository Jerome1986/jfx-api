import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ReplyFeedbackDto } from './dto/reply-feedback.dto';
import { UserJwtGuard } from 'src/common/auth/guards/user-jwt.guard';
import { CurrentUser } from '../common/auth/decorators/current-user.decorator';
import type { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface';
import { QueryFeedbackDto } from './dto/query-feedback.dto';
import { QueryMyFeedbackDto } from './dto/query-my-feedback.dto';

@Controller('feedback')
export class FeedbackController {
  // 注入 FeedbackService，将接口请求交给业务服务处理。
  constructor(private readonly feedbackService: FeedbackService) { }

  // 管理员提交回复：仅待处理、处理中可回复，成功后标记为已回复
  @Patch(':id/reply')
  @UseGuards(UserJwtGuard)
  reply(@Param('id', ParseIntPipe) id: number, @Body() replyFeedbackDto: ReplyFeedbackDto, @CurrentUser('user') admin: { userId: number; type: string }) {
    return this.feedbackService.reply(id, replyFeedbackDto, admin)
  }

  // 用户提交建议
  @Post('submit')
  @UseGuards(UserJwtGuard)
  create(@Body() createFeedbackDto: CreateFeedbackDto, @CurrentUser('user') user: UserJwtPayload) {
    return this.feedbackService.create(createFeedbackDto, user)
  }

  // 根据用户ID查找是否提交过
  @Get('user')
  @UseGuards(UserJwtGuard)
  findOneByUser(@CurrentUser('user') user: UserJwtPayload) {
    return this.feedbackService.findOneByUser(user)
  }

  // 我的反馈记录：分页查询本人全部状态的反馈，包含管理员回复
  @Get('mine')
  @UseGuards(UserJwtGuard)
  findMine(@Query() queryDto: QueryMyFeedbackDto, @CurrentUser('user') user: UserJwtPayload) {
    return this.feedbackService.findMine(queryDto, user)
  }

  // 后台管理获取所有意见反馈
  @Get('all')
  findAll(@Query() queryDto: QueryFeedbackDto) {
    return this.feedbackService.findAll(queryDto)
  }
}
