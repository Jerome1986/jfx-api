import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { UserJwtGuard } from 'src/common/auth/guards/user-jwt.guard';
import { CurrentUser } from '../common/auth/decorators/current-user.decorator';
import type { UserJwtPayload } from 'src/common/auth/interfaces/user-jwt-payload.interface';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) { }

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
}
