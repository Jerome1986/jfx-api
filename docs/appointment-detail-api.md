# 预约详情接口对接文档

> 本文依据当前代码实现整理，供后台管理详情页联调使用。接口路径、返回结构和异常行为均以现有实现为准。

## 1. 接口概览

| 项目 | 内容 |
| --- | --- |
| 接口名称 | 获取预约详情 |
| 请求方法 | `GET` |
| 当前请求路径 | `/api/appointment/detail/:id` |
| 路径参数 | `id`：预约主键 ID |
| 当前鉴权 | 控制器中未声明鉴权守卫 |
| 成功返回 | `{ code: 200, message: "success", data: AppointmentDetail | null }` |


```http
GET /api/appointment/detail/101
```

如果后端后续将路由修正为 `detail/:id`，前端请求地址也需要同步调整。

## 2. 请求参数

| 参数 | 位置 | 类型 | 必传 | 示例 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `id` | path | number | 是 | `101` | 预约表主键 ID，不是预约编号 `appointmentNo` |

当前控制器通过一元运算符 `+id` 将字符串转换为数字，但没有使用 `ParseIntPipe` 或 DTO 校验。后台应保证：

- `id` 是大于 0 的整数；
- 不要传预约编号，例如 `APT20260822...`；
- 不要传空字符串、小数、负数或非数字字符。

## 3. 成功响应示例

HTTP 状态码：`200`

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 101,
    "appointmentNo": "APT20260822103530123A1B2C3",
    "userId": 12,
    "employeeId": null,
    "caseId": null,
    "planId": 8,
    "type": "PLAN",
    "source": "空间焕新",
    "customerName": null,
    "mobile": "13800138000",
    "houseType": null,
    "city": null,
    "area": null,
    "roomLayout": null,
    "demand": "局部空间焕新",
    "snapshot": {
      "title": "客厅焕新方案",
      "cover": "https://example.com/cover.jpg",
      "referencePrice": "19999.00",
      "items": [
        {
          "sourceItemId": 21,
          "candidateId": null,
          "productId": 35,
          "category": "主材",
          "name": "客厅地板",
          "description": "耐磨复合地板",
          "unit": "㎡",
          "unitPrice": "199.00",
          "quantity": "30",
          "image": "https://example.com/item.jpg"
        }
      ]
    },
    "focus": null,
    "visitDate": null,
    "timeSlot": null,
    "visitAddress": null,
    "status": "PENDING_CONTACT",
    "completedAt": null,
    "canceledAt": null,
    "createdAt": "2026-08-22T02:35:30.123Z",
    "updatedAt": "2026-08-22T02:35:30.123Z",
    "case": null,
    "user": {
      "id": 12,
      "userNo": "USER000012",
      "role": "CUSTOMER",
      "mobile": "13800138000",
      "password": null,
      "openid": null,
      "nickname": "张三",
      "realName": null,
      "gender": "MALE",
      "avatar": null,
      "source": null,
      "city": "上海",
      "tags": null,
      "points": 0,
      "totalPointsEarned": 0,
      "totalPointsUsed": 0,
      "status": true,
      "createdAt": "2026-08-20T08:00:00.000Z",
      "updatedAt": "2026-08-20T08:00:00.000Z"
    },
    "employee": null,
    "plan": {
      "id": 8,
      "name": "客厅焕新方案",
      "summary": "局部空间焕新",
      "tags": ["客厅"],
      "startingPrice": "19999.00",
      "cover": "https://example.com/cover.jpg",
      "images": [],
      "detail": null,
      "shareTitle": null,
      "shareImage": null,
      "sort": 0,
      "isRecommended": true,
      "recommendSort": 1,
      "status": "PUBLISHED",
      "createdAt": "2026-08-01T08:00:00.000Z",
      "updatedAt": "2026-08-01T08:00:00.000Z"
    },
    "followUps": [],
    "project": null
  }
}
```

示例值仅用于说明结构。日期字段为 ISO 8601 字符串；Prisma `Decimal` 字段经 JSON 序列化后通常表现为字符串。

## 4. 预约主记录字段

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `id` | number | 否 | 预约主键 ID |
| `appointmentNo` | string | 否 | 对外展示的预约编号 |
| `userId` | number | 是 | 客户用户 ID |
| `employeeId` | number | 是 | 负责员工 ID，未分配时为 `null` |
| `caseId` | number | 是 | 关联装修案例 ID |
| `planId` | number | 是 | 关联焕新方案 ID |
| `type` | enum | 否 | 预约类型 |
| `source` | string | 是 | 来源渠道 |
| `customerName` | string | 是 | 客户姓名 |
| `mobile` | string | 否 | 联系手机号 |
| `houseType` | string | 是 | 房屋类型 |
| `city` | string | 是 | 所在城市 |
| `area` | string | 是 | 房屋面积，Decimal 通常序列化为字符串 |
| `roomLayout` | string | 是 | 户型布局 |
| `demand` | string | 是 | 装修需求 |
| `snapshot` | object | 是 | 预约提交时的方案与项目快照 |
| `focus` | string | 是 | 关注重点 |
| `visitDate` | string | 是 | 上门日期 |
| `timeSlot` | string | 是 | 预约时段 |
| `visitAddress` | string | 是 | 上门地址 |
| `status` | enum | 否 | 当前预约状态 |
| `completedAt` | string | 是 | 完成时间 |
| `canceledAt` | string | 是 | 取消时间 |
| `createdAt` | string | 否 | 预约提交时间 |
| `updatedAt` | string | 否 | 最近更新时间 |

## 5. 预约枚举

### 5.1 预约类型 `type`

| 值 | 含义 |
| --- | --- |
| `BUDGET` | 装修预算 |
| `MEASURE` | 免费量房 |
| `QUOTE` | 房屋报价 |
| `PLAN` | 焕新方案预约 |
| `CASE` | 同款案例报价 |
| `OUTLET` | 网点咨询 |

### 5.2 预约状态 `status`

| 值 | 含义 |
| --- | --- |
| `PENDING_CONTACT` | 待联系 |
| `PENDING_VISIT` | 待上门 |
| `COMPLETED` | 已完成 |
| `CANCELED` | 已取消 |

## 6. 方案快照 `snapshot`

详情页应优先用快照展示客户预约时选择的方案。`plan` 是方案当前数据，后续可能被编辑或下线；`snapshot` 才是提交预约当时的数据。

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 否 | 预约时的方案标题 |
| `cover` | string | 是 | 方案封面 |
| `referencePrice` | string | 否 | 参考价格 |
| `items` | array | 否 | 客户选择的方案项目 |

`snapshot.items[]` 字段：

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `sourceItemId` | number | 否 | 来源方案明细 ID |
| `candidateId` | number | 是 | 候选项 ID |
| `productId` | number | 是 | 商品 ID |
| `category` | string | 否 | 项目分类 |
| `name` | string | 否 | 项目名称 |
| `description` | string | 是 | 项目描述 |
| `unit` | string | 否 | 计价单位 |
| `unitPrice` | string | 否 | 单价 |
| `quantity` | string | 否 | 数量 |
| `image` | string | 是 | 项目图片 |

如需展示快照项目小计，前端可使用：

```ts
const subtotal = Number(item.unitPrice) * Number(item.quantity)
```

展示总参考价时优先使用 `snapshot.referencePrice`，避免自行汇总结果与用户提交时展示价格不一致。

## 7. 关联数据

接口当前返回以下关联对象：

| 字段 | 类型 | 可空 | 内容 |
| --- | --- | --- | --- |
| `user` | object | 是 | 客户用户完整标量字段 |
| `employee` | object | 是 | 负责员工完整标量字段 |
| `case` | object | 是 | 关联装修案例完整标量字段 |
| `plan` | object | 是 | 关联焕新方案完整标量字段 |
| `followUps` | array | 否 | 该预约的全部跟进记录 |
| `project` | object | 是 | 预约转化后的装修项目 |

### 7.1 客户 `user`

详情页建议使用：`id`、`userNo`、`nickname`、`realName`、`mobile`、`avatar`、`city`、`tags`、`status`、`createdAt`。

客户展示名称建议：

```ts
const customerDisplayName =
  detail.customerName ??
  detail.user?.realName ??
  detail.user?.nickname ??
  '-'
```

### 7.2 负责人 `employee`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 员工主键 ID |
| `userId` | number | 员工关联用户 ID |
| `employeeNo` | string | 员工编号 |
| `position` | string \| null | 岗位 |
| `department` | string \| null | 部门 |
| `serviceRegions` | unknown | 服务区域 JSON |
| `hiredAt` | string \| null | 入职时间 |
| `status` | boolean | 是否在职/可用 |
| `createdAt` | string | 创建时间 |
| `updatedAt` | string | 更新时间 |

当前 `employee` 未继续关联其 `user`，所以详情接口不能直接取得负责人姓名、昵称、头像和手机号。

### 7.3 跟进记录 `followUps[]`

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `id` | number | 否 | 跟进记录 ID |
| `appointmentId` | number | 是 | 关联预约 ID |
| `projectId` | number | 是 | 关联项目 ID |
| `employeeId` | number | 是 | 跟进员工 ID |
| `content` | string | 否 | 跟进内容 |
| `nextFollowAt` | string | 是 | 下次跟进时间 |
| `createdAt` | string | 否 | 跟进记录创建时间 |

当前跟进记录没有排序，也没有返回跟进员工详情。时间轴展示前建议前端按 `createdAt` 倒序排序。

### 7.4 转化项目 `project`

核心字段包括：`id`、`projectNo`、`name`、`customerName`、`mobile`、`serviceAddress`、`quotedAmount`、`contractAmount`、`status`、`completedAt`、`createdAt`、`updatedAt`。

项目状态：

| 值 | 含义 |
| --- | --- |
| `PENDING_CONFIRM` | 待确认 |
| `IN_SERVICE` | 服务中 |
| `COMPLETED` | 已完成 |
| `CANCELED` | 已取消 |

## 8. 后台详情页建议布局

1. **顶部摘要**：预约编号、预约类型、状态、提交时间、来源、负责人。
2. **客户信息**：客户姓名、手机号、城市、用户编号、账号状态。
3. **房屋与上门信息**：房屋类型、户型、面积、上门日期、时段、地址。
4. **需求信息**：装修需求、关注重点。
5. **预约方案快照**：方案标题、封面、参考价格和快照项目表格。
6. **关联内容**：当前方案或案例信息。
7. **跟进时间轴**：跟进内容、跟进员工 ID、创建时间、下次跟进时间。
8. **转化项目**：已转项目时展示项目编号、报价、合同金额和项目状态。

控制器当前已提供新增跟进和取消焕新方案预约接口；尚未提供分配员工、通用状态修改或转化项目等操作接口。

### 8.1 取消焕新方案预约

```http
PATCH /api/appointment/:id/cancel
```

该接口无需请求体，仅允许取消 `PLAN` 类型且状态为 `PENDING_CONTACT` 或 `PENDING_VISIT` 的预约。成功响应中的 `data`：

```json
{
  "id": 101,
  "appointmentNo": "APT20260822103530123A1B2C3",
  "type": "PLAN",
  "status": "CANCELED",
  "canceledAt": "2026-08-22T03:00:00.000Z"
}
```

- 预约不存在：HTTP 404。
- 非 `PLAN` 类型或已完成：HTTP 400。
- 已取消：按幂等方式返回已有取消结果。

## 9. 前端 TypeScript 类型

```ts
type AppointmentType =
  | 'BUDGET'
  | 'MEASURE'
  | 'QUOTE'
  | 'PLAN'
  | 'CASE'
  | 'OUTLET'

type AppointmentStatus =
  | 'PENDING_CONTACT'
  | 'PENDING_VISIT'
  | 'COMPLETED'
  | 'CANCELED'

interface AppointmentDetailResponse {
  code: 200
  message: 'success'
  data: AppointmentDetail | null
}

interface AppointmentDetail {
  id: number
  appointmentNo: string
  userId: number | null
  employeeId: number | null
  caseId: number | null
  planId: number | null
  type: AppointmentType
  source: string | null
  customerName: string | null
  mobile: string
  houseType: string | null
  city: string | null
  area: string | null
  roomLayout: string | null
  demand: string | null
  snapshot: AppointmentSnapshot | null
  focus: string | null
  visitDate: string | null
  timeSlot: string | null
  visitAddress: string | null
  status: AppointmentStatus
  completedAt: string | null
  canceledAt: string | null
  createdAt: string
  updatedAt: string
  user: Record<string, unknown> | null
  employee: Record<string, unknown> | null
  case: Record<string, unknown> | null
  plan: Record<string, unknown> | null
  followUps: FollowUp[]
  project: Record<string, unknown> | null
}

interface AppointmentSnapshot {
  title: string
  cover: string | null
  referencePrice: string
  items: AppointmentSnapshotItem[]
}

interface AppointmentSnapshotItem {
  sourceItemId: number
  candidateId: number | null
  productId: number | null
  category: string
  name: string
  description: string | null
  unit: string
  unitPrice: string
  quantity: string
  image: string | null
}

interface FollowUp {
  id: number
  appointmentId: number | null
  projectId: number | null
  employeeId: number | null
  content: string
  nextFollowAt: string | null
  createdAt: string
}
```

## 10. 记录不存在时的响应

仓储使用 `findFirst()` 查询，服务层没有对空结果抛出 `NotFoundException`。因此，当前传入不存在的合法 ID 时仍返回 HTTP `200`：

```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

后台可暂时将 `data === null` 识别为“预约不存在或已被删除”。更规范的后端行为应是返回 HTTP `404`。

## 11. 非法 ID

当前没有参数校验。传入非数字 ID 时，`+id` 会得到 `NaN`，随后可能触发 Prisma 参数校验错误，并由服务端返回异常响应。前端不应依赖该错误的具体文案或状态结构。

推荐后端使用 `ParseIntPipe` 并校验 ID 大于 0，例如：

```ts
@Get('detail/:id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.appointmentService.findOne(id)
}
```

## 12. 当前接口风险与改进建议

1. **路由存在拼写错误**：当前为 `detai/:id`，建议统一修正为 `detail/:id`。
2. **不存在时没有返回 404**：建议服务层在查询结果为空时抛出 `NotFoundException('预约不存在')`。
3. **ID 未校验**：建议使用 `ParseIntPipe`，并增加正整数约束。
4. **接口并未限定焕新方案预约**：查询条件只有 `id`，任何预约类型都可能被查询到。
5. **敏感字段暴露**：关联 `user` 使用完整 include，会返回 `password`、`openid` 等字段；建议改为字段白名单 `select`。
6. **关联数据缺少二级信息**：员工姓名、跟进员工信息无法直接展示，需后端补充必要关联或输出专用详情 DTO。
7. **跟进记录无排序**：建议后端按 `createdAt: 'desc'` 返回。
8. **响应契约不够稳定**：直接返回数据库完整对象会使字段随 Prisma Schema 变化；建议构造后台详情专用响应 DTO。
