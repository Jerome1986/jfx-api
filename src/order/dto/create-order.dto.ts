export class CreateOrderDto {
  source?: string
  contactName: string
  serviceAddress: string
  remark?: string
  productAmount: number
  couponDiscount: number
  pointDiscount: number
  pointsUsed: number
  installationFee?: number
  payableAmount: number
  paidAmount: number
}
