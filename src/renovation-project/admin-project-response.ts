import { Prisma } from '../../generated/prisma/client'
import { projectLineAmount } from './project-amount'

export const adminProjectInclude = {
  employee: { select: { user: { select: { realName: true } } } },
  plan: { select: { name: true } },
  quoteItems: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
  progresses: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
  followUps: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
} satisfies Prisma.RenovationProjectInclude

type Project = Prisma.RenovationProjectGetPayload<{
  include: typeof adminProjectInclude
}>

export function toAdminProject(project: Project, detail = true) {
  const base = {
    id: project.id,
    projectNo: project.projectNo,
    name: project.name,
    appointmentId: project.appointmentId,
    userId: project.userId,
    customerName: project.customerName,
    mobile: project.mobile,
    serviceAddress: project.serviceAddress,
    employeeId: project.employeeId,
    employeeName: project.employee?.user.realName ?? null,
    planId: project.planId,
    planName: project.plan?.name ?? null,
    quotedAmount:
      !project.quoteItems.length && project.quotedAmount.isZero()
        ? null
        : project.quotedAmount.toFixed(2),
    contractAmount: project.contractAmount?.toFixed(2) ?? null,
    quoteVersion: project.quoteVersion,
    status: project.status,
    progress: project.progress,
    remark: project.remark,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
  if (!detail) return base
  return {
    ...base,
    items: project.quoteItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      serviceId: item.serviceId ?? null,
      category: item.category,
      name: item.name,
      description: item.description,
      unit: item.unit || null,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity.toString(),
      amount: projectLineAmount(item).toFixed(2),
      image: item.image,
      sort: item.sort,
    })),
    progressRecords: project.progresses.map((record) => ({
      id: record.id,
      status: record.status,
      content: record.content,
      createdAt: record.createdAt.toISOString(),
    })),
    followUps: project.followUps.map(toProjectFollowUp),
  }
}

export function toProjectFollowUp(record: {
  id: number
  appointmentId: number | null
  projectId: number | null
  employeeId: number | null
  content: string
  nextFollowAt: Date | null
  createdAt: Date
}) {
  return {
    ...record,
    nextFollowAt: record.nextFollowAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  }
}
