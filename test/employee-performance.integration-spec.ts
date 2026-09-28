import 'reflect-metadata'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
import { EmployeeRepository } from '../src/employee/employee.repository'

// 仅使用明确指定的测试服务器，创建和清理随机命名的独立数据库。
const serverUrl = process.env.PERFORMANCE_TEST_SERVER_URL
const integration = serverUrl ? describe : describe.skip
integration('员工业绩迁移与真实数据库查询', () => {
  const database = `jfx_performance_test_${randomBytes(8).toString('hex')}`
  let created = false
  let connection: any, db: PrismaClient, employeeId: number, otherId: number
  const start = new Date('2026-08-31T16:00:00Z'), end = new Date('2026-09-30T16:00:00Z')
  const migration = readFileSync('prisma/migrations/20260928010000_add_project_quote_confirmed_at/migration.sql', 'utf8')
  beforeAll(async () => {
    const url = new URL(serverUrl!)
    const config = { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
    const driver = createRequire(require.resolve('@prisma/adapter-mariadb'))('mariadb')
    connection = await driver.createConnection({ ...config, multipleStatements: true, timezone: '+00:00' })
    await connection.query(`CREATE DATABASE ${database}`)
    created = true
    await connection.query(`USE ${database}`)
    const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
    await connection.query(sql)
    db = new PrismaClient({ adapter: new PrismaMariaDb({ ...config, database, timezone: '+00:00' }) })
    const user = await db.user.create({ data: { userNo: 'performance-staff', mobile: '13800000001', role: 'EMPLOYEE' } })
    employeeId = (await db.employee.create({ data: { userId: user.id, employeeNo: 'performance-staff' } })).id
    const other = await db.user.create({ data: { userNo: 'performance-other', mobile: '13800000002', role: 'EMPLOYEE' } })
    otherId = (await db.employee.create({ data: { userId: other.id, employeeNo: 'performance-other', status: false } })).id
  }, 60000)
  afterAll(async () => {
    await db?.$disconnect()
    if (connection) {
      try { if (created) await connection.query(`DROP DATABASE ${database}`) }
      finally { await connection.end() }
    }
  })
  const project = (patch: any = {}) => db.renovationProject.create({ data: {
    projectNo: randomBytes(8).toString('hex'), name: '测试项目', customerName: '测试客户', mobile: '13800000003', serviceAddress: '测试地址',
    employeeId, status: 'IN_SERVICE', contractAmount: '10.00', quoteConfirmedAt: start, ...patch,
  } })

  it('迁移取最早服务中时间，缺少进度保持空值，重复回填不覆盖已有时间', async () => {
    const first = await project({ quoteConfirmedAt: null, progresses: { create: [
      { status: 'IN_SERVICE', createdAt: start },
      { status: 'IN_SERVICE', createdAt: end },
      { status: 'PENDING_CONFIRM', createdAt: new Date('2026-08-01T00:00:00Z') },
    ] } })
    const missing = await project({ quoteConfirmedAt: null })
    await connection.query('ALTER TABLE renovation_project DROP INDEX project_employee_status_confirmed_idx, DROP INDEX project_status_completed_employee_idx, DROP COLUMN quote_confirmed_at')
    await connection.query(migration)
    expect((await db.renovationProject.findUniqueOrThrow({ where: { id: first.id } })).quoteConfirmedAt).toEqual(start)
    expect((await db.renovationProject.findUniqueOrThrow({ where: { id: missing.id } })).quoteConfirmedAt).toBeNull()
    const snapshot = new Date('2026-09-05T00:00:00Z')
    await db.renovationProject.update({ where: { id: first.id }, data: { quoteConfirmedAt: snapshot } })
    await connection.query(migration.slice(migration.indexOf('UPDATE `renovation_project`')))
    expect((await db.renovationProject.findUniqueOrThrow({ where: { id: first.id } })).quoteConfirmedAt).toEqual(snapshot)
    await db.renovationProject.deleteMany()
  })
  it('真实查询隔离员工和状态，月初包含月底不包含，完工独立于签约月份', async () => {
    await project({ mobile: ' included-start ' })
    await project({ mobile: 'included-last', quoteConfirmedAt: new Date(end.getTime() - 1) })
    await project({ mobile: 'excluded-end', quoteConfirmedAt: end })
    await project({ mobile: 'excluded-before', quoteConfirmedAt: new Date(start.getTime() - 1) })
    await project({ mobile: 'excluded-pending', status: 'PENDING_CONFIRM' })
    await project({ mobile: 'excluded-canceled', status: 'CANCELED' })
    await project({ mobile: 'excluded-other', employeeId: otherId })
    await project({ mobile: 'excluded-null-date', quoteConfirmedAt: null })
    await project({ status: 'COMPLETED', quoteConfirmedAt: new Date(start.getTime() - 1), completedAt: start, contractAmount: '20.10' })
    await project({ status: 'COMPLETED', quoteConfirmedAt: null, completedAt: new Date(end.getTime() - 1), contractAmount: '0.20' })
    await project({ status: 'COMPLETED', quoteConfirmedAt: null, completedAt: end })
    await project({ status: 'COMPLETED', quoteConfirmedAt: null, completedAt: start, employeeId: otherId, contractAmount: '30' })
    await project({ status: 'COMPLETED', quoteConfirmedAt: null, completedAt: start, employeeId: null, contractAmount: '1000' })
    const result = await new EmployeeRepository(db as any).performanceSummary(employeeId, start, end)
    expect(result.signedProjects).toHaveLength(2)
    expect(result.signedProjects.reduce((sum, p) => sum + Number(p.contractAmount), 0)).toBeCloseTo(20.30)
    expect(result.completedGroups).toHaveLength(1)
    const mine = result.completedGroups.find(p => p.employeeId === employeeId)!
    expect(mine._count._all).toBe(2)
    expect(mine._sum.contractAmount?.toFixed(2)).toBe('20.30')
    expect(result.completedGroups.find(p => p.employeeId === otherId)).toBeUndefined()
  })
})
