# 后台装修项目接口

## 接入与兼容

所有下列接口使用 `Authorization: Bearer <管理员 token>`，校验管理员账号仍启用。客户和员工 token 返回 403；未登录、过期或无效 token 返回 401。

成功统一 HTTP 200：

```json
{ "code": 200, "message": "操作成功", "data": {} }
```

错误沿用 NestJS 的 HTTP 错误响应：参数非法 400、无权限 403、不存在 404、状态/版本/负责人并发冲突 409。不要仅依靠成功响应中的 `code` 判断错误。

新增接口共用原项目数据。小程序 `/api/renovation-project/user`、`/api/renovation-project/:id`、`/api/renovation-project/:id/confirm` 和员工 `/api/employee/projects` 等原路径、参数与响应结构保持不变。旧接口继续返回 `quoteItems`、`plan` 等字段，不改为后台的 `items`、`planName`。后台新增 `remark`、`progress` 字段不透出到旧项目响应和预约的关联 `project` 对象。

## 列表与详情

`GET /api/project?pageNum=1&pageSize=10&keyword=张&owner=李&status=PENDING_CONFIRM`

- 默认第 1 页、每页 10 条，每页最多 100 条。
- `keyword` 模糊匹配项目名称或客户姓名；`owner` 模糊匹配负责人真实姓名。两者同时提交时取交集。
- 状态不传或传 `ALL` 查询全部；支持 `PENDING_CONFIRM`、`IN_SERVICE`、`COMPLETED`，以及历史状态 `PENDING_QUOTE`、`CANCELED`。
- 按创建时间、ID 倒序。
- `data` 为 `{ list, total, pageNum, pageSize, totalPage }`，空列表时 `totalPage=0`。

`GET /api/project/:id` 返回详情；列表每项包含以下基础字段，详情额外包含三个数组：

```json
{
  "id": 1,
  "projectNo": "ZX20260922020000000A1B2C3D4E5",
  "name": "张先生厨房改造",
  "appointmentId": 10,
  "userId": 20,
  "customerName": "张先生",
  "mobile": "13800138000",
  "serviceAddress": "上海市某小区1号楼",
  "employeeId": 3,
  "employeeName": "李经理",
  "planId": 5,
  "planName": "厨房焕新方案",
  "quotedAmount": "2000.00",
  "contractAmount": null,
  "quoteVersion": 1,
  "status": "PENDING_CONFIRM",
  "progress": "",
  "remark": "",
  "createdAt": "2026-09-22T02:00:00.000Z",
  "updatedAt": "2026-09-22T02:00:00.000Z",
  "items": [
    {
      "id": 1,
      "productId": 100,
      "category": "主材",
      "name": "厨房地砖",
      "description": "防滑地砖",
      "unit": "平方米",
      "unitPrice": "100.00",
      "quantity": "20",
      "amount": "2000.00",
      "image": null,
      "sort": 1
    }
  ],
  "progressRecords": [],
  "followUps": []
}
```

金额为两位小数字符串，单位元；数量为十进制字符串；时间为 ISO 日期时间。无关联字段为 `null`，无数组数据为 `[]`，服务地址、备注、进度默认空字符串。

没有报价明细且报价为零时，后台返回 `quotedAmount: null`；有零价明细时返回 `"0.00"`；历史非零金额保留。原小程序金额序列化不改变。

报价按 `sort`、ID 升序；进度和跟进按创建时间、ID 倒序。项目跟进不混入来源预约的历史跟进。

## 新增、编辑和改派

`POST /api/project`

```json
{
  "name": "张先生厨房改造",
  "customerName": "张先生",
  "mobile": "13800138000",
  "userId": 20,
  "serviceAddress": "上海",
  "employeeId": 3,
  "planId": 5,
  "remark": "客户希望尽快施工"
}
```

`name`、`customerName`、`mobile` 必填，其余选填。三个关联 ID 可为 `null`。新建状态为待确认，无报价、无合同金额，编号由后端生成。姓名、项目名称、地址最多 191 字符，备注最多 5000 字符；手机号按中国大陆手机号码校验。

`PATCH /api/project/:id` 仅接受 `name`、`customerName`、`mobile`、`serviceAddress`、`remark`；省略字段不变，空字符串可清空地址或备注，不接受 `null`。不能通过此接口改状态、金额或关联。

`PATCH /api/project/:id/assignee`：`{ "employeeId": 3 }`。负责人必须是启用的员工，且其关联用户启用、角色为员工。不接受清空负责人。改派不修改来源预约或历史跟进归属。

以上成功均返回最新项目详情。

## 预约转换

`POST /api/appointment/:id/convert`

```json
{ "projectName": "张先生厨房改造", "remark": "客户希望尽快施工" }
```

`projectName` 必填。仅已完成预约可转换，预算/报价类还需有效且大于零的预估金额。姓名、手机号缺失时先补齐预约信息。未分配负责人可以转换；已关联负责人必须仍为有效员工。

复制客户、手机号、上门地址、用户、负责人和方案关联。报价从预约方案快照复制并重新计算，不能将预约预估金额当作项目报价；没有快照明细则保留未报价。非法快照拒绝转换，不从最新商品价格重建报价。

同一预约只生成一个项目；重复及并发转换返回已有项目详情，不覆盖其名称或报价。转换不改变预约状态、不复制预约跟进；预约详情原有 `project` 继续返回关联项目。

## 保存报价

`PUT /api/project/:id/quotation`

```json
{
  "quoteVersion": 1,
  "items": [
    {
      "productId": 100,
      "category": "主材",
      "name": "厨房地砖",
      "description": "防滑地砖",
      "unit": "平方米",
      "unitPrice": "100.00",
      "quantity": "20",
      "image": null,
      "sort": 1
    },
    {
      "productId": null,
      "category": "人工",
      "name": "铺贴人工",
      "unit": "项",
      "unitPrice": "500.00",
      "quantity": "1",
      "sort": 2
    }
  ]
}
```

必须提交当前详情中的 `quoteVersion`。仅待确认项目可保存，至少一行；整体替换明细，不提交行 `id` 或 `amount`。`category` 只接受主材、人工、辅材。`productId`、`description`、`image` 可省略或为 `null`；`sort` 可省略，默认数组下标。

单价、数量使用字符串，最多 8 位整数和 2 位小数；单价非负、数量大于零。每行按 Decimal 相乘并四舍五入到分，再汇总；总金额不得超过 `99999999.99`。项目报价保存名称、单价等快照，不随商品或方案变化。

保存成功返回详情及递增后的 `quoteVersion`。409 时刷新详情重新操作，不自动用旧页面内容覆盖最新版本。

## 进度与合同确认

`POST /api/project/:id/progress`

首次进入服务中：

```json
{
  "status": "IN_SERVICE",
  "content": "客户已线下确认合同",
  "quoteVersion": 2,
  "contractAmount": "2300.00"
}
```

同状态追加说明或完成项目：

```json
{ "status": "COMPLETED", "content": "施工完成，客户验收通过" }
```

仅允许待确认 → 服务中 → 已完成，也允许这三个状态追加同状态说明；禁止跳级、回退或从历史待报价、已取消状态推进。

首次进入服务中必须已有报价明细、提交当前 `quoteVersion` 和非负 `contractAmount`。合同金额可不同于报价，确认后冻结；其他进度请求不能提交合同金额。每次要求非空内容，最多 5000 字符；原子保存进度记录、最新摘要、状态和更新时间，首次完成保存完成时间。

原客户端确认仍只提交 `quoteVersion`，合同金额仍取报价；客户确认、员工完工与取消同步产生进度记录，不增加小程序必填参数。

进度记录格式：`{ id, status, content, createdAt }`。操作成功返回最新项目详情。

## 跟进

`POST /api/project/:id/follow-up`

```json
{
  "employeeId": 3,
  "content": "已联系客户确认施工时间",
  "nextFollowAt": "2026-09-23T02:00:00.000Z"
}
```

必须已有有效负责人，提交的 `employeeId` 必须与当前负责人一致。内容去首尾空白后不能为空，最多 5000 字符；下次跟进时间可省略或为 `null`，提交时使用 ISO 日期时间。

返回新增记录：`{ id, appointmentId: null, projectId, employeeId, content, nextFollowAt, createdAt }`。并发改派导致负责人变化时返回 409，禁止写入错误归属的记录。

## 迁移与验证

迁移：`prisma/migrations/20260922000000_add_project_admin_fields/migration.sql`，仅新增默认空字符串的 `remark`、`progress` 字段，不清空历史数据、不重算历史金额。

部署先在目标数据库执行 `pnpm exec prisma migrate deploy`，随后生成客户端、构建并发布服务。开发实现不自动执行生产迁移。

```sh
pnpm exec prisma generate
pnpm exec prisma validate
pnpm exec jest --config test/project-admin.jest.json --runInBand
pnpm build
```

测试包含后台 HTTP 鉴权、金额与参数校验、业务状态与版本冲突、转换幂等，以及原预约、员工、客户项目回归。测试使用数据库替身；真实 MySQL 的迁移及事务集成验证需在隔离测试数据库进行。
