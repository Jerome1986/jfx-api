const fs = require('node:fs')
const path = require('node:path')
const mariadb = require('../node_modules/.pnpm/mariadb@3.4.5/node_modules/mariadb')

async function main() {
  const service = fs.readFileSync(path.join(__dirname, '../src/prisma/prisma.service.ts'), 'utf8')
  const read = key => service.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1]
  const connection = await mariadb.createConnection({
    host: read('host'), user: read('user'), password: read('password'),
    database: read('database'), port: 3306,
  })
  const targets = ['installation_order', 'product_order_item', 'product_order', 'cart_item', 'stock_log', 'renewal_plan_item', 'product_sku', 'product', 'renewal_plan']
  const related = ['user_coupon', 'appointment', 'renovation_project', 'project_quote_item']
  try {
    const existing = new Set((await connection.query('SHOW TABLES')).map(row => Object.values(row)[0]))
    const tables = targets.filter(table => existing.has(table))
    const counts = {}
    for (const table of [...tables, ...related]) {
      counts[table] = Number((await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``))[0].count)
    }
    console.log(JSON.stringify({ database: read('database'), counts }, null, 2))
    const foreignKeys = await connection.query(
      'SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL',
    )
    console.log(JSON.stringify(foreignKeys.filter(row => targets.includes(row.REFERENCED_TABLE_NAME)), null, 2))
    if (!process.argv.includes('--apply')) return
    await connection.beginTransaction()
    const backup = {}
    for (const table of [...tables, ...related]) {
      backup[table] = await connection.query(`SELECT * FROM \`${table}\` FOR UPDATE`)
    }
    const backupDir = path.join(__dirname, '../.tmp')
    fs.mkdirSync(backupDir, { recursive: true })
    const backupPath = path.join(backupDir, `sku-test-data-${Date.now()}.json`)
    fs.writeFileSync(backupPath, JSON.stringify(backup, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2), { flag: 'wx' })
    console.log(`Backup: ${backupPath}`)
    await connection.query('UPDATE user_coupon SET order_id = NULL WHERE order_id IS NOT NULL')
    await connection.query('UPDATE appointment SET plan_id = NULL WHERE plan_id IS NOT NULL')
    await connection.query('UPDATE renovation_project SET plan_id = NULL WHERE plan_id IS NOT NULL')
    await connection.query('UPDATE project_quote_item SET product_id = NULL WHERE product_id IS NOT NULL')
    for (const table of tables) {
      await connection.query(`DELETE FROM \`${table}\``)
    }
    for (const table of tables) {
      const count = Number((await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``))[0].count)
      if (count !== 0) throw new Error(`Verification failed: ${table}`)
    }
    await connection.commit()
    console.log(JSON.stringify({ cleared: tables, verifiedEmpty: true }))
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
