import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

type QuoteSource = { productId?: number | null; serviceId?: number | null }

@ValidatorConstraint({ name: 'exclusiveQuoteSource', async: false })
export class ExclusiveQuoteSource implements ValidatorConstraintInterface {
  // 校验报价明细不能同时关联商品和服务
  validate(_value: unknown, args: ValidationArguments) {
    const item = args.object as QuoteSource
    return item.productId == null || item.serviceId == null
  }

  // 返回报价来源校验失败提示
  defaultMessage() {
    return '报价明细不能同时关联商品和服务'
  }
}

// 判断报价明细是否需要校验单位
export function shouldValidateQuoteUnit(item: QuoteSource, value: unknown) {
  const productWithoutUnit =
    item.productId != null &&
    item.serviceId == null &&
    (value == null || value === '')
  return !productWithoutUnit
}
