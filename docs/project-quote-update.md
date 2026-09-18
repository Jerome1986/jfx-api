# 待确认报价修改与确认

实际请求路径带 `/api` 前缀，沿用登录鉴权和 `{ code, message, data }` 成功响应。

## 员工修改

`PATCH /api/employee/projects/:id/quote`

```json
{
  "planId": 2,
  "quoteVersion": 1,
  "quoteRemark": "调整施工数量",
  "quoteItems": [
    { "category": "人工", "name": "安装", "unit": "次", "unitPrice": "12.35", "quantity": "2.5" }
  ]
}
```

`planId`、`quoteVersion`、非空 `quoteItems` 必填。明细复用创建项目的字段和校验规则；`productId` 可选，填写时必须存在。数量大于零，单价非负，两者均使用最多两位小数的字符串。单价沿用现有员工报价输入规则，不自动替换成商品目录价。

服务端精确计算所有单价乘数量之和，汇总后四舍五入到两位小数，上限 `99999999.99`。不接受 `quotedAmount`、负责人或客户信息等额外字段。备注可选，最长 500 字符；省略、空白或 null 表示本次无备注，仅保留最新备注。

仅负责员工可修改 `PENDING_CONFIRM` 项目。按提交版本进行条件更新，同一事务内替换完整明细（原明细 ID 不保留）、更新方案及金额、版本加一、更新时间。状态保持待确认，合同金额不变。响应包含保存后的项目、方案及排序后的明细。

## 客户确认

`PATCH /api/renovation-project/:id/confirm`

```json
{ "quoteVersion": 2 }
```

必须提交客户实际看到的版本，不能在点击确认时自动获取新版本后直接重试。版本和待确认状态匹配时进入 `IN_SERVICE`，合同金额取该版本服务端报价。报价总额未变但方案或明细已修改，也需要重新确认。

## 查询与错误处理

员工详情及客户列表、详情返回 `quoteVersion`、`quoteRemark`、`updatedAt` 和最新报价；客户查询补充关联方案和明细排序。

- `400`：缺少版本、空明细、非法参数、无效方案或商品、金额超限。
- `403`：员工账号或角色不可用。
- `404`：项目不存在或不属于当前操作人，沿用现有归属查询行为。
- `409`：状态、归属或版本在操作前后发生变化。提示刷新，不自动覆盖或确认。

员工保存成功后重新请求项目详情。客户端显示最新版本/更新时间，收到 409 后加载最新详情并让客户重新阅读确认。

## 发布与验证

先执行 `20260917000000_add_project_quote_version` 数据库迁移，再生成 Prisma Client、发布后端。历史项目初始版本为 1。同步发布前端确认请求中的版本参数；旧的无请求体确认会返回 400，不能静默兼容，否则无法防止误确认。创建、查询、完成项目的原有接口参数保持不变。

专项测试：`pnpm exec jest --config test/project-quote.jest.json --runInBand`。

真实数据库测试：设置 `QUOTE_TEST_SERVER_URL` 为测试 MySQL 服务器连接串，再执行 `pnpm exec jest --config test/project-quote.integration.jest.json --runInBand`。账号需要创建/删除数据库权限；测试仅创建并清理随机命名的 `jfx_quote_test_*` 数据库，不修改连接串指向的业务库。未设置连接串时跳过该集成测试。
