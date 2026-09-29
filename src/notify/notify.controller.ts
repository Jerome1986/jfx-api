import { Controller, Post, Body, Res } from '@nestjs/common'
import { NotifyService } from './notify.service'

@Controller('notify')
export class NotifyController {
  // 注入 NotifyService，将接口请求交给业务服务处理。
  constructor(private readonly notifyService: NotifyService) { }

  // 支付回调
  @Post()
  async create(@Body() data: any, @Res() res) {
    const result = await this.notifyService.wxNotify(data)
    res.status(200).json(result)
  }

  // 退款回调
  @Post('refund')
  async refund(@Body() data: any, @Res() res) {
    const result = await this.notifyService.wxRefund()
    res.status(200).json(result)
  }
}
