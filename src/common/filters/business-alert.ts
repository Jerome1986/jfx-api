import type { Prisma } from '../../../generated/prisma/client'

// DATE 字段保存日历日期，以 UTC 零点表示；与北京时间自然日比较。
export function beijingCalendarDate(now: Date) {
  return new Date(new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10) + 'T00:00:00.000Z')
}

export function appointmentAlert(type: 'uncontacted' | 'unassigned', now: Date): Prisma.AppointmentWhereInput {
  return type === 'uncontacted'
    ? { status: 'PENDING_CONTACT', createdAt: { lt: new Date(now.getTime() - 2 * 3600000) } }
    : { employeeId: null, status: { in: ['PENDING_CONTACT', 'PENDING_VISIT'] } }
}

export function projectAlert(now: Date): Prisma.RenovationProjectWhereInput {
  return {
    status: { in: ['PENDING_QUOTE', 'PENDING_CONFIRM', 'IN_SERVICE'] },
    plannedCompletionDate: { lt: beijingCalendarDate(now) },
  }
}

export function installationAlert(now: Date): Prisma.ProductOrderWhereInput {
  return {
    status: { in: ['PENDING_INSTALLATION', 'IN_SERVICE'] }, paymentStatus: 'PAID',
    installation: { is: {
      status: { in: ['PENDING_APPOINTMENT', 'PENDING_ASSIGNMENT', 'PENDING_VISIT', 'IN_SERVICE'] },
      scheduledEndAt: { lt: now },
    } },
  }
}

export function feedbackAlert(now: Date): Prisma.FeedbackWhereInput {
  return { status: 'PENDING', createdAt: { lt: new Date(now.getTime() - 24 * 3600000) } }
}
