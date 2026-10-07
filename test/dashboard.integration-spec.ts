import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// 显式指定有建库权限的测试连接；仅操作随机命名的临时库。
const serverUrl = process.env.DASHBOARD_TEST_SERVER_URL
const integration = serverUrl ? describe : describe.skip
integration('工作台日期迁移', () => {
  const database = 'jfx_dashboard_test_' + randomBytes(8).toString('hex')
  let connection: any
  let created = false
  beforeAll(async () => {
    const url = new URL(serverUrl!)
    const maria = createRequire(require.resolve('@prisma/adapter-mariadb'))('mariadb')
    connection = await maria.createConnection({
      host: url.hostname, port: Number(url.port || 3306),
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      multipleStatements: true, connectTimeout: 3000, dateStrings: true,
    })
    await connection.query('CREATE DATABASE ' + database)
    created = true
    await connection.query('USE ' + database)
    // 仅建立该迁移涉及的旧字段，用真实 MySQL 执行 ALTER、时间回填和索引创建。
    await connection.query("CREATE TABLE renovation_project (id INT PRIMARY KEY, status VARCHAR(32)); CREATE TABLE installation_order (id INT PRIMARY KEY, status VARCHAR(32), appointment_date DATETIME(3), time_slot VARCHAR(191))")
    await connection.query("INSERT INTO renovation_project VALUES (1, 'IN_SERVICE')")
    const slots = ['09:00-12:00', '00:00-00:30', null, '', '上午', '24:00-25:00', '12:00-09:00', '09:00-09:00']
    for (let i = 0; i < slots.length; i++) {
      await connection.query("INSERT INTO installation_order VALUES (?, 'IN_SERVICE', '2026-10-06 00:00:00', ?)", [i + 1, slots[i]])
    }
    await connection.query("INSERT INTO installation_order VALUES (9, 'IN_SERVICE', NULL, '09:00-12:00')")
    await connection.query(readFileSync('prisma/migrations/20261006010000_add_dashboard_dates/migration.sql', 'utf8'))
  })
  afterAll(async () => {
    if (!connection) return
    try {
      if (created && /^jfx_dashboard_test_[a-f0-9]{16}$/.test(database)) await connection.query('DROP DATABASE ' + database)
    } finally { await connection.end() }
  })
  it('计划日期默认null，历史项目不推算排期', async () => {
    const rows = await connection.query('SELECT planned_completion_date FROM renovation_project')
    expect(rows[0].planned_completion_date).toBeNull()
  })
  it('有效时间按北京时间换算UTC，包含跨日', async () => {
    const rows = await connection.query('SELECT id, scheduled_end_at FROM installation_order ORDER BY id')
    expect(rows[0].scheduled_end_at).toMatch(/^2026-10-06 04:00:00/)
    expect(rows[1].scheduled_end_at).toMatch(/^2026-10-05 16:30:00/)
    expect(rows.slice(2).every(row => row.scheduled_end_at === null)).toBe(true)
  })
  it('数据库严格结束时间筛选，不包含null或边界相等的记录', async () => {
    const rows = await connection.query("SELECT id FROM installation_order WHERE scheduled_end_at < '2026-10-06 04:00:00' ORDER BY id")
    expect(rows.map(row => row.id)).toEqual([2])
  })
  it('新增两组查询索引', async () => {
    const project = await connection.query('SHOW INDEX FROM renovation_project')
    const installation = await connection.query('SHOW INDEX FROM installation_order')
    expect(project.some(row => row.Key_name === 'project_status_planned_completion_idx')).toBe(true)
    expect(installation.some(row => row.Key_name === 'installation_status_scheduled_end_idx')).toBe(true)
  })
})
