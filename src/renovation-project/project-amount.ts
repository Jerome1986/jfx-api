import { BadRequestException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'

export function projectLineAmount(item: {
  unitPrice: string | Prisma.Decimal
  quantity: string | Prisma.Decimal
}) {
  return new Prisma.Decimal(item.unitPrice)
    .mul(item.quantity)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

export function projectQuoteTotal(
  items: {
    unitPrice: string | Prisma.Decimal
    quantity: string | Prisma.Decimal
  }[],
) {
  const total = items.reduce(
    (sum, item) => sum.plus(projectLineAmount(item)),
    new Prisma.Decimal(0),
  )
  if (total.greaterThan('99999999.99'))
    throw new BadRequestException('报价总额超出允许范围')
  return total
}
