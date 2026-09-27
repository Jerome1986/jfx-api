// 文件说明：原始响应装饰器，用于跳过统一响应封装。
import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_WRAP_KEY = 'skipResponseWrap';

// 标记接口直接返回原始响应
export const RawResponse = () => SetMetadata(SKIP_RESPONSE_WRAP_KEY, true);
