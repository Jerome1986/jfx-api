// 文件说明：应用基础服务，提供通用示例逻辑。
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'jfx';
  }
}
