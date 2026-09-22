import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { randomBytes } from 'node:crypto'
import { RenovationProjectStatus } from '../../generated/prisma/enums'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  adminProjectInclude,
  toAdminProject,
  toProjectFollowUp,
} from './admin-project-response'
import {
  AddProjectFollowUpDto,
  AddProjectProgressDto,
  AdminQuoteItemDto,
  ConvertAppointmentDto,
  CreateAdminProjectDto,
  EditAdminProjectDto,
  QueryAdminProjectDto,
  SaveAdminQuotationDto,
} from './dto/admin-project.dto'
import { projectQuoteTotal } from './project-amount'

@Injectable()
export class AdminProjectService {
  constructor(private readonly prisma: PrismaService) {}

  private projectNo() {
    return `ZX${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}${randomBytes(5).toString('hex').toUpperCase()}`
  }

  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(work)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (['P2025', 'P2034'].includes(error.code))
          throw new ConflictException(
            '项目状态、报价或负责人已变化，请刷新后重试',
          )
        if (error.code === 'P2003')
          throw new BadRequestException('关联数据不存在或已删除')
      }
      throw error
    }
  }

  private async project(tx: Prisma.TransactionClient, id: number) {
    const project = await tx.renovationProject.findUnique({
      where: { id },
      include: adminProjectInclude,
    })
    if (!project) throw new NotFoundException('装修项目不存在')
    return project
  }

  // Conditional update acquires the project row lock and rejects stale state.
  private async lock(
    tx: Prisma.TransactionClient,
    project: {
      id: number
      updatedAt: Date
      employeeId: number | null
      status: RenovationProjectStatus
      quoteVersion: number
    },
  ) {
    const updatedAt = new Date(
      Math.max(Date.now(), project.updatedAt.getTime() + 1),
    )
    await tx.renovationProject.update({
      where: {
        id: project.id,
        updatedAt: project.updatedAt,
        employeeId: project.employeeId,
        status: project.status,
        quoteVersion: project.quoteVersion,
      },
      data: { updatedAt },
    })
    return updatedAt
  }

  private async employee(tx: Prisma.TransactionClient, id: number) {
    const employee = await tx.employee.findUnique({
      where: { id },
      include: { user: { select: { status: true, role: true } } },
    })
    if (
      !employee?.status ||
      !employee.user.status ||
      employee.user.role !== 'EMPLOYEE'
    ) {
      throw new BadRequestException('负责人必须是有效在职员工')
    }
  }

  private async relations(
    tx: Prisma.TransactionClient,
    dto: CreateAdminProjectDto,
  ) {
    if (dto.employeeId != null) await this.employee(tx, dto.employeeId)
    if (
      dto.userId != null &&
      !(await tx.user.findUnique({
        where: { id: dto.userId },
        select: { id: true },
      }))
    )
      throw new BadRequestException('关联用户不存在')
    if (
      dto.planId != null &&
      !(await tx.renewalPlan.findUnique({
        where: { id: dto.planId },
        select: { id: true },
      }))
    )
      throw new BadRequestException('关联方案不存在')
  }

  private async quoteSources(
    tx: Prisma.TransactionClient,
    items: AdminQuoteItemDto[],
  ) {
    const ids = [
      ...new Set(
        items.flatMap((item) =>
          item.productId == null ? [] : [item.productId],
        ),
      ),
    ]
    if (
      ids.length &&
      (await tx.product.count({ where: { id: { in: ids } } })) !== ids.length
    )
      throw new BadRequestException('报价包含不存在的商品')
    if (items.some((item) => item.productId != null && item.serviceId != null))
      throw new BadRequestException('报价明细不能同时关联商品和服务')
    const serviceIds = [
      ...new Set(
        items.flatMap((item) =>
          item.serviceId == null ? [] : [item.serviceId],
        ),
      ),
    ]
    if (
      serviceIds.length &&
      (await tx.constructionService.count({
        where: { id: { in: serviceIds } },
      })) !== serviceIds.length
    )
      throw new BadRequestException('报价包含不存在的服务')
  }

  private quoteData(items: AdminQuoteItemDto[]) {
    return items.map((item, index) => ({
      productId: item.productId ?? null,
      serviceId: item.serviceId ?? null,
      category: item.category,
      name: item.name,
      description: item.description ?? null,
      unit: item.unit ?? '',
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      image: item.image ?? null,
      sort: item.sort ?? index,
    }))
  }

  async list(query: QueryAdminProjectDto) {
    const where: Prisma.RenovationProjectWhereInput = {
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword } },
              { customerName: { contains: query.keyword } },
            ],
          }
        : {}),
      ...(query.owner
        ? {
            employee: {
              is: { user: { is: { realName: { contains: query.owner } } } },
            },
          }
        : {}),
    }
    const [list, total] = await this.prisma.$transaction([
      this.prisma.renovationProject.findMany({
        where,
        include: {
          ...adminProjectInclude,
          progresses: false,
          followUps: false,
        },
        skip: (query.pageNum - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.renovationProject.count({ where }),
    ])
    return {
      list: list.map((project) =>
        toAdminProject({ ...project, progresses: [], followUps: [] }, false),
      ),
      total,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      totalPage: Math.ceil(total / query.pageSize),
    }
  }

  async detail(id: number) {
    return toAdminProject(await this.project(this.prisma, id))
  }

  async create(dto: CreateAdminProjectDto) {
    return this.transaction(async (tx) => {
      await this.relations(tx, dto)
      const project = await tx.renovationProject.create({
        data: {
          ...dto,
          serviceAddress: dto.serviceAddress ?? '',
          remark: dto.remark ?? '',
          projectNo: this.projectNo(),
          status: 'PENDING_CONFIRM',
          quotedAmount: 0,
        },
        include: adminProjectInclude,
      })
      return toAdminProject(project)
    })
  }

  async edit(id: number, dto: EditAdminProjectDto) {
    if (
      !Object.keys(dto).length ||
      Object.values(dto).some((value) => value === null)
    )
      throw new BadRequestException('请提交有效的项目修改字段')
    return this.transaction(async (tx) => {
      const project = await this.project(tx, id)
      const updatedAt = await this.lock(tx, project)
      return toAdminProject(
        await tx.renovationProject.update({
          where: { id },
          data: { ...dto, updatedAt },
          include: adminProjectInclude,
        }),
      )
    })
  }

  async assign(id: number, employeeId: number) {
    return this.transaction(async (tx) => {
      const project = await this.project(tx, id)
      await this.employee(tx, employeeId)
      const updatedAt = await this.lock(tx, project)
      return toAdminProject(
        await tx.renovationProject.update({
          where: { id },
          data: { employeeId, updatedAt },
          include: adminProjectInclude,
        }),
      )
    })
  }

  async convert(
    appointmentId: number,
    dto: ConvertAppointmentDto,
    attempt = 0,
  ): Promise<ReturnType<typeof toAdminProject>> {
    try {
      return await this.transaction(async (tx) => {
        const appointment = await tx.appointment.findUnique({
          where: { id: appointmentId },
        })
        if (!appointment) throw new NotFoundException('预约不存在')
        const existing = await tx.renovationProject.findUnique({
          where: { appointmentId },
          include: adminProjectInclude,
        })
        if (existing) return toAdminProject(existing)
        if (appointment.status !== 'COMPLETED')
          throw new BadRequestException('请先完成预约服务再创建装修项目')
        if (
          ['BUDGET', 'QUOTE'].includes(appointment.type) &&
          (!appointment.estimatedAmount ||
            !appointment.estimatedAmount.greaterThan(0))
        )
          throw new BadRequestException('请先提交有效的预约预估报价')
        if (!appointment.customerName?.trim() || !appointment.mobile?.trim())
          throw new BadRequestException('请先补齐预约客户姓名和手机号')
        if (appointment.employeeId != null)
          await this.employee(tx, appointment.employeeId)
        const items = await this.snapshotItems(appointment.snapshot)
        await this.quoteSources(tx, items)
        // Also serialize conversion against edits to the source appointment.
        await tx.appointment.update({
          where: {
            id: appointmentId,
            updatedAt: appointment.updatedAt,
            status: 'COMPLETED',
            employeeId: appointment.employeeId,
          },
          data: {
            updatedAt: new Date(
              Math.max(Date.now(), appointment.updatedAt.getTime() + 1),
            ),
          },
        })
        const project = await tx.renovationProject.create({
          data: {
            projectNo: this.projectNo(),
            appointmentId,
            userId: appointment.userId,
            employeeId: appointment.employeeId,
            planId: appointment.planId,
            name: dto.projectName,
            customerName: appointment.customerName.trim(),
            mobile: appointment.mobile,
            serviceAddress: appointment.visitAddress ?? '',
            remark: dto.remark ?? '',
            status: 'PENDING_CONFIRM',
            quotedAmount: projectQuoteTotal(items),
            quoteItems: { create: this.quoteData(items) },
          },
          include: adminProjectInclude,
        })
        return toAdminProject(project)
      })
    } catch (error) {
      if (
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      ) {
        const existing = await this.prisma.renovationProject.findUnique({
          where: { appointmentId },
          include: adminProjectInclude,
        })
        if (existing) return toAdminProject(existing)
        if (attempt < 2) return this.convert(appointmentId, dto, attempt + 1)
        throw new ConflictException('预约转换发生冲突，请重试')
      }
      throw error
    }
  }

  private async snapshotItems(
    snapshot: Prisma.JsonValue,
  ): Promise<AdminQuoteItemDto[]> {
    if (snapshot == null) return []
    if (typeof snapshot !== 'object' || Array.isArray(snapshot))
      throw new BadRequestException('预约方案快照格式无效')
    if (snapshot.items == null) return []
    if (!Array.isArray(snapshot.items))
      throw new BadRequestException('预约报价快照格式无效')
    const items: AdminQuoteItemDto[] = []
    for (const raw of snapshot.items) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new BadRequestException('预约报价快照明细无效')
      const item = plainToInstance(AdminQuoteItemDto, {
        productId: raw.productId,
        serviceId: raw.serviceId,
        category: raw.category,
        name: raw.name,
        description: raw.description,
        unit: raw.unit,
        unitPrice: raw.unitPrice,
        quantity: raw.quantity,
        image: raw.image,
        sort: raw.sort,
      })
      if ((await validate(item)).length)
        throw new BadRequestException('预约报价快照明细无效，请先修正快照')
      items.push(item)
    }
    return items
  }

  async quotation(id: number, dto: SaveAdminQuotationDto) {
    const quotedAmount = projectQuoteTotal(dto.items)
    return this.transaction(async (tx) => {
      const project = await this.project(tx, id)
      if (
        project.status !== 'PENDING_CONFIRM' ||
        project.quoteVersion !== dto.quoteVersion
      )
        throw new ConflictException('项目状态或报价版本已变化，请刷新后重试')
      await this.quoteSources(tx, dto.items)
      const updatedAt = await this.lock(tx, project)
      await tx.renovationProject.update({
        where: { id },
        data: { quotedAmount, quoteVersion: { increment: 1 }, updatedAt },
      })
      await tx.projectQuoteItem.deleteMany({ where: { projectId: id } })
      await tx.projectQuoteItem.createMany({
        data: this.quoteData(dto.items).map((item) => ({
          ...item,
          projectId: id,
        })),
      })
      return toAdminProject(await this.project(tx, id))
    })
  }

  async progress(id: number, dto: AddProjectProgressDto, adminId: number) {
    return this.transaction(async (tx) => {
      const project = await this.project(tx, id)
      const next = {
        PENDING_CONFIRM: 'IN_SERVICE',
        IN_SERVICE: 'COMPLETED',
        COMPLETED: null,
      }
      if (
        !(project.status in next) ||
        (dto.status !== project.status && next[project.status] !== dto.status)
      )
        throw new ConflictException('不允许跳级或回退项目状态')
      const confirming =
        project.status === 'PENDING_CONFIRM' && dto.status === 'IN_SERVICE'
      if (confirming) {
        if (dto.quoteVersion == null || dto.contractAmount == null)
          throw new BadRequestException('进入服务中必须提交报价版本和合同金额')
        if (dto.quoteVersion !== project.quoteVersion)
          throw new ConflictException('报价已更新，请刷新后重新确认')
        if (!project.quoteItems.length)
          throw new BadRequestException('请先保存报价明细')
      } else if (dto.contractAmount !== undefined)
        throw new BadRequestException('仅首次进入服务中可填写合同金额')
      const updatedAt = await this.lock(tx, project)
      return toAdminProject(
        await tx.renovationProject.update({
          where: { id },
          data: {
            status: dto.status,
            progress: dto.content,
            updatedAt,
            ...(confirming
              ? { contractAmount: new Prisma.Decimal(dto.contractAmount!) }
              : {}),
            ...(project.status !== 'COMPLETED' && dto.status === 'COMPLETED'
              ? { completedAt: new Date() }
              : {}),
            progresses: {
              create: {
                status: dto.status,
                content: dto.content,
                createdBy: `admin:${adminId}`,
              },
            },
          },
          include: adminProjectInclude,
        }),
      )
    })
  }

  async followUp(id: number, dto: AddProjectFollowUpDto) {
    return this.transaction(async (tx) => {
      const project = await this.project(tx, id)
      if (project.employeeId == null)
        throw new BadRequestException('请先分配负责人')
      if (project.employeeId !== dto.employeeId)
        throw new ConflictException('负责人已变化，请刷新后重试')
      await this.employee(tx, dto.employeeId)
      await this.lock(tx, project)
      return toProjectFollowUp(
        await tx.followUp.create({
          data: {
            projectId: id,
            employeeId: dto.employeeId,
            content: dto.content,
            nextFollowAt: dto.nextFollowAt ? new Date(dto.nextFollowAt) : null,
          },
        }),
      )
    })
  }
}
