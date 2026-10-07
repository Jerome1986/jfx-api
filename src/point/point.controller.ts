import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/auth/decorators/current-user.decorator'
import { UserJwtGuard } from '../common/auth/guards/user-jwt.guard'
import { AdjustPointDto } from './dto/adjust-point.dto'
import { PointAccountParamsDto, QueryPointAccountsDto, QueryPointFlowsDto } from './dto/query-point.dto'
import { PointGuard } from './point.guard'
import { PointService } from './point.service'

@Controller('point')
@UseGuards(UserJwtGuard, PointGuard)
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get('accounts')
  accounts(@Query() query: QueryPointAccountsDto) {
    return this.pointService.accounts(query)
  }

  @Get('accounts/:userId')
  account(@Param() params: PointAccountParamsDto) {
    return this.pointService.account(params.userId)
  }

  @Post('accounts/:userId/adjust')
  @HttpCode(200)
  adjust(@Param() params: PointAccountParamsDto, @Body() dto: AdjustPointDto, @CurrentUser() actor: { userId: number }) {
    return this.pointService.adjust(params.userId, dto, actor.userId)
  }

  @Get('flows')
  flows(@Query() query: QueryPointFlowsDto) {
    return this.pointService.flows(query)
  }

  @Get('flows/:id')
  flow(@Param('id') id: string) {
    return this.pointService.flow(id)
  }
}
