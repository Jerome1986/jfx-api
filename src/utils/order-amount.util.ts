import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'

type OrderAmountItem = { productId: number; quantity: number }
type ProductPrice = { id: number; price: Prisma.Decimal }

/** 根据数据库查询出的售价计算总金额；不访问数据库，全程保留Decimal精度。 */
export function calculateProductAmount(
  items: readonly OrderAmountItem[],
  products: readonly ProductPrice[],
): Prisma.Decimal {
  if (!items.length) throw new BadRequestException('至少选择一件商品')

  const productMap = new Map(products.map(product => [product.id, product]))
  const total = items.reduce((amount, item) => {
    const product = productMap.get(item.productId)
    if (!product) throw new NotFoundException(`商品${item.productId}不存在`)
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new BadRequestException('购买数量必须是正整数')
    }
    const subtotal = new Prisma.Decimal(product.price).mul(item.quantity)
    return amount.plus(subtotal)
  }, new Prisma.Decimal(0))

  if (total.gt(new Prisma.Decimal('99999999.99'))) {
    throw new BadRequestException('商品总金额不能超过99999999.99元')
  }
  return total
}
