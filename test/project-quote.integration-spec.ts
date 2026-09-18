import 'reflect-metadata'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
import { EmployeeRepository } from '../src/employee/employee.repository'
import { EmployeeService } from '../src/employee/employee.service'
import { RenovationProjectRepository } from '../src/renovation-project/renovation-project.repository'
import { RenovationProjectService } from '../src/renovation-project/renovation-project.service'

// Explicit opt-in. Creates and drops only a randomly named isolated test database.
const serverUrl = process.env.QUOTE_TEST_SERVER_URL
const integration = serverUrl ? describe : describe.skip
integration('报价真实数据库事务与并发', () => {
  const database = `jfx_quote_test_${randomBytes(8).toString('hex')}`
  let databaseCreated = false
  let admin: any, db: PrismaClient, employeeService: EmployeeService, customerService: RenovationProjectService
  let employeeUser: any, customerUser: any, employeeId: number, planId: number, projectId: number
  const item = { category: '人工', name: '安装', unit: '次', unitPrice: '10.00', quantity: '2' }
  beforeAll(async () => {
    const url = new URL(serverUrl!)
    const config = { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
    const mariadb = require('mariadb')
    admin = await mariadb.createConnection({ ...config, multipleStatements: true })
    await admin.query(`CREATE DATABASE ${database}`)
    databaseCreated = true
    await admin.query(`USE ${database}`)
    const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
    await admin.query(sql)
    db = new PrismaClient({ adapter: new PrismaMariaDb({ ...config, database, connectionLimit: 5 }) })
    const staff = await db.user.create({ data: { userNo: 'staff', mobile: '13800000001', role: 'EMPLOYEE' } })
    const customer = await db.user.create({ data: { userNo: 'customer', mobile: '13800000002' } })
    employeeId = (await db.employee.create({ data: { userId: staff.id, employeeNo: 'staff' } })).id
    planId = (await db.renewalPlan.create({ data: { name: '标准方案', startingPrice: '10', status: 'PUBLISHED' } })).id
    employeeUser = { userId: staff.id, role: 'EMPLOYEE', type: 'user' }
    customerUser = { userId: customer.id, role: 'CUSTOMER', type: 'user' }
    employeeService = new EmployeeService(new EmployeeRepository(db as any), {} as any, {} as any, {} as any, db as any)
    customerService = new RenovationProjectService(new RenovationProjectRepository(db as any))
  }, 60000)
  beforeEach(async () => {
    projectId = (await db.renovationProject.create({ data: { projectNo: randomBytes(8).toString('hex'), userId: customerUser.userId, employeeId, planId, name: '项目', customerName: '客户', mobile: '13800000002', serviceAddress: '测试地址', quotedAmount: '20', quoteItems: { create: [item] } } })).id
  })
  afterAll(async () => {
    if (db) await db.$disconnect()
    if (admin) {
      try { if (databaseCreated) await admin.query(`DROP DATABASE ${database}`) } finally { await admin.end() }
    }
  })
  const dto = () => ({ planId, quoteVersion: 1, quoteRemark: '调整', quoteItems: [{ ...item, quantity: '3' }] })
  it.each(['PENDING_CONFIRM', 'IN_SERVICE'] as const)('取消%s保留报价、明细和合同，双方详情可读且后续操作被拒绝', async expectedStatus => {
    if (expectedStatus === 'IN_SERVICE') await customerService.confirmProject(projectId, customerUser, { quoteVersion: 1 })
    const before = await db.renovationProject.findUniqueOrThrow({ where: { id: projectId }, include: { quoteItems: true } })
    const canceled = await employeeService.cancelProject(projectId, { reason: '协商取消', expectedStatus }, employeeUser)
    expect(canceled.status).toBe('CANCELED')
    expect(canceled.quoteItems).toEqual(before.quoteItems)
    expect(canceled.quotedAmount).toEqual(before.quotedAmount)
    expect(canceled.contractAmount).toEqual(before.contractAmount)
    expect(canceled.canceledByEmployeeId).toBe(employeeId)
    const customerDetail = await customerService.findOne(projectId, customerUser)
    expect(customerDetail.cancelReason).toBe('协商取消')
    expect(customerDetail.canceledAt).toEqual(canceled.canceledAt)
    await expect(customerService.confirmProject(projectId, customerUser, { quoteVersion: 1 })).rejects.toMatchObject({ status: 409 })
    await expect(employeeService.updateProjectQuote(projectId, dto(), employeeUser)).rejects.toMatchObject({ status: 409 })
    await expect(employeeService.completeProject(projectId, employeeUser)).rejects.toMatchObject({ status: 409 })
    await expect(employeeService.cancelProject(projectId, { reason: '重复', expectedStatus }, employeeUser)).rejects.toMatchObject({ status: 409 })
  })
  it.each(['confirm', 'complete', 'cancel'] as const)('取消与%s并发时仅一个状态转换成功', async action => {
    const expectedStatus = action === 'complete' ? 'IN_SERVICE' : 'PENDING_CONFIRM'
    if (action === 'complete') await customerService.confirmProject(projectId, customerUser, { quoteVersion: 1 })
    const cancel = () => employeeService.cancelProject(projectId, { reason: '取消', expectedStatus }, employeeUser)
    const results = await Promise.allSettled([
      cancel(),
      action === 'confirm' ? customerService.confirmProject(projectId, customerUser, { quoteVersion: 1 })
        : action === 'complete' ? employeeService.completeProject(projectId, employeeUser) : cancel(),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason.getStatus()).toBe(409)
  })
  it('修改保存版本、金额和明细；旧版本确认失败', async () => {
    const saved = await employeeService.updateProjectQuote(projectId, dto(), employeeUser)
    expect(saved.quoteVersion).toBe(2)
    expect(saved.quotedAmount.toString()).toBe('30')
    expect(saved.quoteItems[0].quantity.toString()).toBe('3')
    await expect(customerService.confirmProject(projectId, customerUser, { quoteVersion: 1 })).rejects.toMatchObject({ status: 409 })
    const confirmed = await customerService.confirmProject(projectId, customerUser, { quoteVersion: 2 })
    expect(confirmed.status).toBe('IN_SERVICE')
    expect(confirmed.contractAmount!.toString()).toBe('30')
  })
  it('实际数据库写入失败时回滚项目及删除的旧明细', async () => {
    const before = await db.renovationProject.findUniqueOrThrow({ where: { id: projectId }, include: { quoteItems: true } })
    // Invalid column length forces a real INSERT failure after parent UPDATE and detail DELETE.
    await expect(employeeService.updateProjectQuote(projectId, { ...dto(), quoteItems: [{ ...item, name: 'x'.repeat(1000) }] }, employeeUser)).rejects.toThrow()
    const after = await db.renovationProject.findUniqueOrThrow({ where: { id: projectId }, include: { quoteItems: true } })
    expect(after).toEqual(before)
  })
  it('修改与确认并发时仅一方成功，合同金额与成功版本一致', async () => {
    const results = await Promise.allSettled([
      employeeService.updateProjectQuote(projectId, dto(), employeeUser),
      customerService.confirmProject(projectId, customerUser, { quoteVersion: 1 }),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason.getStatus()).toBe(409)
    const project = await db.renovationProject.findUniqueOrThrow({ where: { id: projectId } })
    if (project.status === 'IN_SERVICE') {
      expect(project.quoteVersion).toBe(1)
      expect(project.contractAmount!.toString()).toBe('20')
    } else {
      expect(project.quoteVersion).toBe(2)
      expect(project.contractAmount).toBeNull()
    }
  })
})
