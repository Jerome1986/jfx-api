# 后台用户积分与积分流水

统一前缀 `/api/point`，所有接口使用管理员 `Authorization: Bearer <token>`，管理员必须存在且启用。沿用项目全局响应包装。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /accounts | 用户积分分页 |
| GET | /accounts/:userId | 用户积分详情 |
| POST | /accounts/:userId/adjust | 人工调整积分，成功 HTTP 200 |
| GET | /flows | 积分流水分页 |
| GET | /flows/:id | 流水详情 |

## 查询

账户列表支持 `page`（默认 1）、`pageSize`（默认 10，支持 10/20/50）、`keyword`、`hasDebt`。
`keyword` 按用户 ID 精确匹配、昵称或手机号模糊匹配。`hasDebt` 传 `true`/`false`，不传查询全部。

账户字段：`userId, nickname, phone, balance, earned, used, debt`。新用户的积分字段默认 0；用户不存在返回 404。手机号对应现有用户表的 `mobile`。

流水列表支持 `page, pageSize, userId, keyword, orderNo, type, startDate, endDate`。分页约束同账户列表；日期必须为 `YYYY-MM-DD`，按北京时间计算，含结束日。按 `createdAt DESC, id DESC` 排序。

分页响应：

```json
{
  "code": 200,
  "message": "success",
  "data": { "list": [], "total": 0, "page": 1, "pageSize": 10 }
}
```

流水 ID 为 `PF` 加数据库主键，例如 `PF123`；前端直接使用返回值，不拼接日期。
列表字段：`id, userId, nickname, type, before, after, debtBefore, debtAfter, orderId, orderNo, occurredAt, source`。
详情另含 `refundNo, reason, operatorId, operatorName, earned, offset`。
时间为 ISO 字符串，无关联信息返回 null。非获得类流水的 `earned/offset` 返回 null。仅欠积分变化也会记录流水。

业务类型支持 `ORDER_REWARD, ORDER_DEDUCT, CANCEL_RETURN, REFUND_RETURN, REFUND_RECOVER, MANUAL_INCREASE, MANUAL_DECREASE`。
历史无法确认来源的数据保留 `LEGACY_INCOME, LEGACY_EXPENSE, LEGACY_MANUAL, LEGACY_EXPIRED`，支持按这些类型筛选；旧流水无法追溯的管理员 ID 保持 null。

## 人工调整

```json
{
  "direction": "increase",
  "amount": 100,
  "reason": "售后补偿",
  "requestId": "dc2b6532-9d94-4b31-9119-73fe56b3561e"
}
```

- direction：increase 或 decrease。
- amount：正整数，最大 1000000000，不接受数字字符串。
- reason：去掉首尾空白后非空，最多 300 字。
- requestId：1～100 位字母、数字、下划线或短横线；建议 UUID。全局唯一且区分大小写，同一次操作重试使用相同值。
- 不接收前端余额、操作人等额外字段。

相同请求号、用户、管理员及规范化参数返回第一次的结果；参数不同返回 409。增加先抵偿欠积分，剩余增加可用余额；扣减只能使用最新可用余额。行锁、账户更新、流水插入均在同一事务中执行，唯一索引防止重复提交。

成功 data 示例：

```json
{
  "flowId": "PF123",
  "userId": 1001,
  "amount": 100,
  "offset": 30,
  "balanceBefore": 120,
  "balanceAfter": 190,
  "debtBefore": 30,
  "debtAfter": 0
}
```

成功后重新查询账户及流水；重复请求返回原调整快照，可能不同于账户此刻的最新余额。

## 统计口径

- balance：当前可用积分，非负；debt：独立记录的待追回积分，非负。
- earned：累计实际获得总额，包含购物奖励、人工增加，包含用于抵偿欠积分的部分；退款追回不冲减累计获得。
- used：下单抵扣（包含待支付订单占用）与人工扣减；取消／退款返还冲减累计使用，最低为 0。退款追回和历史过期不计入累计使用。
- 取消／退款返还不计入累计获得，返还也先抵偿欠积分。
- 现有下单、取消、支付回调和用户端积分统计已统一到上述口径；支付成功不重复累计使用。
- 迁移根据已有流水回填累计值，保留当前余额；历史未知收入、支出分别计入获得与使用。
- 本次提供后台查询与人工调整，并同步现有订单扣减、取消返还。未新增支付奖励或退款业务触发流程；这些流程后续可在事务内调用 `writePointChange` 写入对应类型。

## 错误

400 参数错误、余额不足或整数范围溢出；401 未登录或凭证无效；403 无权限或管理员禁用；404 用户／流水不存在；409 幂等参数冲突或事务并发冲突。错误使用项目标准 `statusCode/message/error` 结构。

## 数据库与验证

新增迁移：`prisma/migrations/20261006000000_add_point_accounts/migration.sql`，添加欠积分、流水快照、审计与请求唯一索引，并将调整原因扩展为 300 字。发布时需要先执行迁移，累计数据回填期间停止旧版本积分写入，再启用新代码。

```sh
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm build
pnpm exec jest --config test/point.jest.json --runInBand
```

真实数据库测试：使用具有创建临时数据库权限的测试账号设置 `POINT_TEST_SERVER_URL`，然后运行：

```sh
pnpm exec jest --config test/point.integration.jest.json --runInBand
```

该测试仅创建并清理随机命名的 `jfx_point_test_*` 临时库，验证迁移、回填、并发重复提交、超扣保护与回滚，不修改业务库。
