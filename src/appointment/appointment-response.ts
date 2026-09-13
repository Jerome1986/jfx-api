import { Prisma } from '../../generated/prisma/client'

// 仅格式化预约预估字段，保留其他字段和关联对象的原有结构。
export function toAppointmentResponse<
  T extends {
    estimatedAmount: Prisma.Decimal | null
    estimateDescription: string | null
    estimatedAt: Date | null
  },
>(appointment: T) {
  return {
    ...appointment,
    estimatedAmount: appointment.estimatedAmount?.toFixed(2) ?? null,
    estimateDescription: appointment.estimateDescription ?? null,
    estimatedAt: appointment.estimatedAt?.toISOString() ?? null,
  }
}
