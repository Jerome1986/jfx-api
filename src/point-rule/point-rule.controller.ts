import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/auth/decorators/current-user.decorator'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { CreatePointRuleDto } from './dto/create-point-rule.dto'
import { PointRuleGuard } from './point-rule.guard'
import { PointRuleService } from './point-rule.service'

@Controller('point-rule')
@UseGuards(UserJwtGuard, PointRuleGuard)
export class PointRuleController {
  constructor(private readonly pointRuleService: PointRuleService) {}

  // 保存全局规则，首次创建，后续整体更新。
  @Post()
  @HttpCode(200)
  save(@Body() dto: CreatePointRuleDto, @CurrentUser() actor: { userId: number }) {
    return this.pointRuleService.save(dto, actor.userId)
  }

  // 尚未配置时返回 null，由管理端提示首次设置。
  @Get()
  findCurrent() {
    return this.pointRuleService.findCurrent()
  }
}
