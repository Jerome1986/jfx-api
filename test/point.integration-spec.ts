import 'reflect-metadata'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
import { PointRepository } from '../src/point/point.repository'
import { PointService } from '../src/point/point.service'
import { writePointChange } from '../src/point/point-ledger'

// 显式指定测试服务器；只创建、删除本次随机命名的隔离库，不修改业务数据库。
const serverUrl = process.env.POINT_TEST_SERVER_URL
const integration = serverUrl ? describe : describe.skip
integration('积分真实数据库迁移、事务和并发', () => {
  const database = 'jfx_point_test_' + randomBytes(8).toString('hex')
  let connection: any, db: PrismaClient, repo: PointRepository, service: PointService
  let created = false, adminId: number, userId: number
  const requestId = () => randomBytes(16).toString('hex')
  const increase = (id = requestId()) => ({ direction: 'increase' as const, amount: 100, reason: '售后补偿', requestId: id })
  beforeAll(async () => {
    const url = new URL(serverUrl!)
    const config = { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
    const maria = createRequire(require.resolve('@prisma/adapter-mariadb'))('mariadb')
    connection = await maria.createConnection({ ...config, multipleStatements: true, connectTimeout: 3000 })
    await connection.query('CREATE DATABASE ' + database)
    created = true
    await connection.query('USE ' + database)
    const temp = mkdtempSync(join(tmpdir(), 'jfx-point-schema-'))
    try {
      let schema = readFileSync('prisma/schema.prisma', 'utf8')
      schema = schema.replace(/^  pointDebt .+\r?\n/m, '')
      schema = schema.replace(/model PointRecord \{[\s\S]*?\n\}/, block => block
        .replace(/^  (flowType|balanceBefore|debtBefore|debtAfter|earned|offset|orderId|orderNo|refundNo|operatorId|requestId|amount|source) .+\r?\n/gm, '')
        .replace(/^  @@index\(\[(createdAt, id|flowType, createdAt)\]\)\r?\n/gm, ''))
      const schemaPath = join(temp, 'schema.prisma')
      writeFileSync(schemaPath, schema)
      const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', schemaPath, '--script'], { encoding: 'utf8' })
      await connection.query(sql)
    } finally {
      if (!temp.startsWith(join(tmpdir(), 'jfx-point-schema-'))) throw new Error('临时目录越界')
      rmSync(temp, { recursive: true })
    }
    await connection.query("INSERT INTO user (user_no, mobile, points, total_points_earned, total_points_used, updated_at) VALUES ('legacy', '13900000000', 110, 999, 999, NOW())")
    const legacy = [
      ['INCOME', null, 100, 100, '历史获得'],
      ['MANUAL', null, 20, 120, '人工增加'],
      ['EXPENSE', 'PRODUCT_ORDER', -30, 90, '待支付订单占用积分'],
      ['INCOME', 'PRODUCT_ORDER', 30, 120, '取消待支付订单返还积分'],
      ['MANUAL', null, -10, 110, '人工扣减'],
    ]
    const changeColumn = String.fromCharCode(96) + 'change' + String.fromCharCode(96)
    for (const [type, business, change, balance, description] of legacy) {
      await connection.query('INSERT INTO point_record (user_id, type, business_type, related_no, ' + changeColumn + ', balance, description) VALUES (1, ?, ?, ?, ?, ?, ?)',
        [type, business, business ? 'legacy-order' : null, change, balance, description])
    }
    await connection.query(readFileSync('prisma/migrations/20261006000000_add_point_accounts/migration.sql', 'utf8'))
    db = new PrismaClient({ adapter: new PrismaMariaDb({ ...config, database, connectionLimit: 8 }) })
    adminId = (await db.admin.create({ data: { username: 'point-admin', password: 'test-only', name: '管理员' } })).id
    repo = new PointRepository(db as never)
    service = new PointService(repo)
  }, 60000)
  beforeEach(async () => {
    if (!db) return
    const suffix = requestId()
    userId = (await db.user.create({ data: { userNo: suffix, mobile: suffix.slice(0, 11), points: 120, pointDebt: 30, totalPointsEarned: 500, totalPointsUsed: 380 } })).id
  })
  afterAll(async () => {
    if (db) await db.$disconnect()
    if (connection) {
      try {
        if (created && /^jfx_point_test_[a-f0-9]{16}$/.test(database)) await connection.query('DROP DATABASE ' + database)
      } finally { await connection.end() }
    }
  })

  it('迁移保留余额，按流水回填累计及历史快照', async () => {
    expect(await service.account(1)).toMatchObject({ balance: 110, earned: 120, used: 10, debt: 0 })
    const records = await db.pointRecord.findMany({ where: { userId: 1 }, orderBy: { id: 'asc' } })
    expect(records.map(row => row.flowType)).toEqual(['LEGACY_INCOME', 'MANUAL_INCREASE', 'ORDER_DEDUCT', 'CANCEL_RETURN', 'MANUAL_DECREASE'])
    expect(records.map(row => row.balanceBefore)).toEqual([0, 100, 120, 90, 120])
    expect(records[3].earned).toBeNull()
  })
  it('真实调整先抵偿欠积分并写入完整审计', async () => {
    const result = await service.adjust(userId, increase(), adminId)
    expect(result).toMatchObject({ amount: 100, offset: 30, balanceBefore: 120, balanceAfter: 190, debtBefore: 30, debtAfter: 0 })
    expect(await service.account(userId)).toMatchObject({ balance: 190, debt: 0, earned: 600, used: 380 })
    expect(await service.flow(result.flowId)).toMatchObject({ operatorId: adminId, operatorName: 'point-admin', reason: '售后补偿', earned: 100, offset: 30 })
  })
  it('并发重复请求只增加一次并返回同一流水', async () => {
    const dto = increase()
    const results = await Promise.all(Array.from({ length: 5 }, () => service.adjust(userId, dto, adminId)))
    expect(new Set(results.map(row => row.flowId)).size).toBe(1)
    expect(await db.pointRecord.count({ where: { userId } })).toBe(1)
    expect(await service.account(userId)).toMatchObject({ balance: 190, earned: 600 })
  })
  it('同一请求号参数变化或跨用户复用返回409', async () => {
    const dto = increase()
    await service.adjust(userId, dto, adminId)
    await expect(service.adjust(userId, { ...dto, amount: 101 }, adminId)).rejects.toMatchObject({ status: 409 })
    await expect(service.adjust(1, dto, adminId)).rejects.toMatchObject({ status: 409 })
  })
  it('并发不同请求号不会丢失更新', async () => {
    await Promise.all(Array.from({ length: 5 }, () => service.adjust(userId, { ...increase(), amount: 10 }, adminId)))
    expect(await service.account(userId)).toMatchObject({ balance: 140, debt: 0, earned: 550, used: 380 })
    expect(await db.pointRecord.count({ where: { userId } })).toBe(5)
  })
  it('并发扣减不会超扣或转成欠积分', async () => {
    const results = await Promise.allSettled(Array.from({ length: 3 }, () => service.adjust(userId, {
      direction: 'decrease', amount: 80, reason: '调整扣减', requestId: requestId(),
    }, adminId)))
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1)
    const errors = results.filter(row => row.status === 'rejected') as PromiseRejectedResult[]
    expect(errors.every(row => row.reason.status === 400)).toBe(true)
    expect(await service.account(userId)).toMatchObject({ balance: 40, debt: 30, used: 460 })
    expect(await db.pointRecord.count({ where: { userId } })).toBe(1)
  })
  it('订单扣减与人工扣减共享账户锁，不会超扣', async () => {
    const results = await Promise.allSettled([
      service.adjust(userId, { direction: 'decrease', amount: 80, reason: '人工扣减', requestId: requestId() }, adminId),
      db.$transaction(tx => writePointChange(tx, { userId, flowType: 'ORDER_DEDUCT', amount: 80, reason: '订单扣减', orderNo: 'order-concurrent' })),
    ])
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1)
    expect(await service.account(userId)).toMatchObject({ balance: 40, used: 460 })
  })
  it('流水插入唯一键失败，已执行的账户更新整体回滚', async () => {
    const dto = increase()
    await service.adjust(1, dto, adminId)
    const before = await service.account(userId)
    await expect(db.$transaction(tx => writePointChange(tx, {
      userId, flowType: 'MANUAL_INCREASE', amount: 20, reason: '模拟写入失败', requestId: dto.requestId,
    }))).rejects.toMatchObject({ code: 'P2002' })
    expect(await service.account(userId)).toEqual(before)
    expect(await db.pointRecord.count({ where: { userId } })).toBe(0)
  })
  it('requestId 区分大小写', async () => {
    const key = 'case-' + requestId()
    await service.adjust(userId, increase(key), adminId)
    await service.adjust(userId, increase(key.toUpperCase()), adminId)
    expect(await db.pointRecord.count({ where: { userId } })).toBe(2)
  })
  it('订单取消冲减累计使用，返还积分先偿还欠积分', async () => {
    await db.$transaction(tx => writePointChange(tx, { userId, flowType: 'CANCEL_RETURN', amount: 50, reason: '取消返还', orderNo: 'cancel-order' }))
    expect(await service.account(userId)).toMatchObject({ balance: 140, debt: 0, earned: 500, used: 330 })
  })
  it('北京时间筛选含结束日、同一时间按主键倒序', async () => {
    for (const at of ['2026-10-05T15:59:59Z', '2026-10-05T16:00:00Z', '2026-10-06T15:59:59Z', '2026-10-06T15:59:59Z', '2026-10-06T16:00:00Z']) {
      await db.pointRecord.create({ data: { userId, type: 'INCOME', flowType: 'ORDER_REWARD', change: 1, balance: 1, createdAt: new Date(at) } })
    }
    const result = await service.flows({ userId, page: 1, pageSize: 10, startDate: '2026-10-06', endDate: '2026-10-06' })
    expect(result.total).toBe(3)
    expect(Number(result.list[0].id.slice(2))).toBeGreaterThan(Number(result.list[1].id.slice(2)))
  })
})
