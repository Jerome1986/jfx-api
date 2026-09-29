// 文件说明：应用基础控制器，提供根级接口。
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  // 注入 AppService，将接口请求交给业务服务处理。
  constructor(private readonly appService: AppService) {}

  // 获取应用欢迎信息
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
