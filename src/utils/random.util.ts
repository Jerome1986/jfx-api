// 文件说明：随机值生成相关的通用工具。
import { randomInt } from 'node:crypto'

const ALPHANUMERIC_CHARACTERS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * 生成指定长度的随机字母数字字符串。
 */
export function generateRandomCode(length = 8): string {
  return Array.from(
    { length },
    () => ALPHANUMERIC_CHARACTERS[randomInt(ALPHANUMERIC_CHARACTERS.length)],
  ).join('')
}
