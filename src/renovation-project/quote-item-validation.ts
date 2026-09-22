import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

type QuoteSource = { productId?: number | null; serviceId?: number | null }

@ValidatorConstraint({ name: 'exclusiveQuoteSource', async: false })
export class ExclusiveQuoteSource implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const item = args.object as QuoteSource
    return item.productId == null || item.serviceId == null
  }

  defaultMessage() {
    return '报价明细不能同时关联商品和服务'
  }
}

export function shouldValidateQuoteUnit(item: QuoteSource, value: unknown) {
  const productWithoutUnit =
    item.productId != null &&
    item.serviceId == null &&
    (value == null || value === '')
  return !productWithoutUnit
}
