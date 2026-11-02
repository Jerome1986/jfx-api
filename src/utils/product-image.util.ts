import type { Prisma } from '../../generated/prisma/client'

/** 订单快照和方案封面只取轮播图的第一张。 */
export function productCoverImage(images: Prisma.JsonValue): string {
  return Array.isArray(images) && typeof images[0] === 'string' ? images[0] : ''
}
