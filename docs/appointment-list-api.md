# 预约列表接口对接文档

> 本文依据当前代码实现整理，供后台管理页面的预约列表联调使用。文中的“当前行为”均以现有接口为准。

## 1. 接口概览

| 项目         | 内容                                       |
| ------------ | ------------------------------------------ |
| 接口名称     | 获取预约列表                               |
| 请求方法     | `GET`                                      |
| 请求路径     | `/api/appointment`                         |
| Content-Type | 无请求体；查询参数通过 URL 传递            |
| 当前鉴权     | 控制器中未声明鉴权守卫                     |
| 返回格式     | JSON，统一包装为 `{ code, message, data }` |

请求示例：

```http
GET /api/appointment?pageNum=1&pageSize=10&type=PLAN
```

## 2. 查询参数

| 参数       | 类型                 | 必传 | 示例   | 说明                                        |
| ---------- | -------------------- | ---- | ------ | ------------------------------------------- |
| `pageNum`  | string（数字字符串） | 是   | `1`    | 当前页码。控制器会通过 `Number()` 转成数字  |
| `pageSize` | string（数字字符串） | 是   | `10`   | 每页条数。控制器会通过 `Number()` 转成数字  |
| `type`     | enum                 | 否   | `PLAN` | 预约类型筛选；传 `ALL` 或不传时查询全部类型 |

注意：

- DTO 对两个参数都使用了 `@IsString()`，且全局校验不允许缺少必传字段，因此当前请求必须同时传 `pageNum` 和 `pageSize`。
- 虽然控制器中存在 `1` 和 `10` 的默认值，但请求会先经过 DTO 校验；不传参数时通常会先返回 400，默认值实际上无法生效。
- 当前 DTO 未校验正整数。前端应主动保证 `pageNum >= 1`、`pageSize >= 1`，不要传小数、负数或非数字字符串。
- `type` 可选，支持 `ALL`、`BUDGET`、`MEASURE`、`QUOTE`、`PLAN`、`CASE`、`OUTLET`；`ALL` 与不传参数都表示全部，其他值会返回 400。
- 全局白名单开启且禁止额外字段；传入未在 DTO 中声明的筛选参数会返回 400。

## 3. 成功响应

HTTP 状态码：`200`

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
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
          "items": []
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
    ],
    "total": 1,
    "pageNum": 1,
    "pageSize": 10,
    "totalPage": 1
  }
}
```

说明：示例值仅用于说明结构；实际字段值取决于数据库记录。Prisma 的 `Decimal` 字段经 JSON 序列化后通常表现为字符串，例如 `"19999.00"`。

## 4. 分页对象

| 字段             | 类型   | 说明                                             |
| ---------------- | ------ | ------------------------------------------------ |
| `data.list`      | array  | 当前页预约数据                                   |
| `data.total`     | number | 预约总数                                         |
| `data.pageNum`   | number | 当前页码                                         |
| `data.pageSize`  | number | 每页条数                                         |
| `data.totalPage` | number | 总页数，计算方式为 `Math.ceil(total / pageSize)` |

## 5. 预约主记录字段

| 字段            | 类型   | 可空 | 说明                                         |
| --------------- | ------ | ---- | -------------------------------------------- |
| `id`            | number | 否   | 预约主键 ID                                  |
| `appointmentNo` | string | 否   | 预约编号                                     |
| `userId`        | number | 是   | 关联用户 ID                                  |
| `employeeId`    | number | 是   | 负责员工 ID；未分配时为 `null`               |
| `caseId`        | number | 是   | 关联装修案例 ID                              |
| `planId`        | number | 是   | 关联焕新方案 ID                              |
| `type`          | enum   | 否   | 预约类型，见枚举说明                         |
| `source`        | string | 是   | 来源渠道；焕新方案预约创建时固定为“空间焕新” |
| `customerName`  | string | 是   | 客户姓名                                     |
| `mobile`        | string | 否   | 联系手机号                                   |
| `houseType`     | string | 是   | 房屋类型                                     |
| `city`          | string | 是   | 所在城市                                     |
| `area`          | string | 是   | 面积，数据库 Decimal 序列化后通常为字符串    |
| `roomLayout`    | string | 是   | 户型布局                                     |
| `demand`        | string | 是   | 装修需求；焕新方案预约中保存方案简介         |
| `snapshot`      | object | 是   | 提交预约时的方案和明细快照，详见下文         |
| `focus`         | string | 是   | 关注重点                                     |
| `visitDate`     | string | 是   | 上门日期，ISO 8601 时间字符串                |
| `timeSlot`      | string | 是   | 预约时段                                     |
| `visitAddress`  | string | 是   | 上门地址                                     |
| `status`        | enum   | 否   | 预约状态，见枚举说明                         |
| `completedAt`   | string | 是   | 完成时间，ISO 8601 时间字符串                |
| `canceledAt`    | string | 是   | 取消时间，ISO 8601 时间字符串                |
| `createdAt`     | string | 否   | 创建时间，ISO 8601 时间字符串                |
| `updatedAt`     | string | 否   | 更新时间，ISO 8601 时间字符串                |
| `case`          | object | 是   | 关联装修案例完整记录                         |
| `user`          | object | 是   | 关联用户完整记录                             |
| `employee`      | object | 是   | 关联员工完整记录                             |
| `plan`          | object | 是   | 关联焕新方案完整记录                         |
| `followUps`     | array  | 否   | 跟进记录列表，无记录时为 `[]`                |
| `project`       | object | 是   | 由预约转化出的装修项目记录                   |

## 6. 枚举说明

### 6.1 `type` 预约类型

| 值        | 中文含义     |
| --------- | ------------ |
| `BUDGET`  | 装修预算     |
| `MEASURE` | 免费量房     |
| `QUOTE`   | 房屋报价     |
| `PLAN`    | 焕新方案预约 |
| `CASE`    | 同款案例报价 |
| `OUTLET`  | 网点咨询     |

### 6.2 `status` 预约状态

| 值                | 中文含义 | 建议标签色  |
| ----------------- | -------- | ----------- |
| `PENDING_CONTACT` | 待联系   | 橙色/警告色 |
| `PENDING_VISIT`   | 待上门   | 蓝色/处理中 |
| `COMPLETED`       | 已完成   | 绿色/成功色 |
| `CANCELED`        | 已取消   | 灰色/禁用色 |

## 7. `snapshot` 快照结构

后台查看预约详情时，建议优先展示快照，而不是只依赖当前 `plan` 数据。方案后续可能被编辑或下线，快照代表用户提交预约当时看到和选择的内容。

| 字段             | 类型   | 可空 | 说明               |
| ---------------- | ------ | ---- | ------------------ |
| `title`          | string | 否   | 预约时的方案标题   |
| `cover`          | string | 是   | 预约时的方案封面   |
| `referencePrice` | string | 否   | 预约时的参考价格   |
| `items`          | array  | 否   | 用户选择的方案明细 |

`snapshot.items[]`：

| 字段           | 类型   | 可空 | 说明            |
| -------------- | ------ | ---- | --------------- |
| `sourceItemId` | number | 否   | 来源方案明细 ID |
| `candidateId`  | number | 是   | 候选项 ID       |
| `productId`    | number | 是   | 商品 ID         |
| `category`     | string | 否   | 项目分类        |
| `name`         | string | 否   | 项目名称        |
| `description`  | string | 是   | 项目描述        |
| `unit`         | string | 否   | 计价单位        |
| `unitPrice`    | string | 否   | 单价            |
| `quantity`     | string | 否   | 数量            |
| `image`        | string | 是   | 项目图片        |

## 8. 关联对象关键字段

接口当前通过 Prisma `include` 返回关联表的全部标量字段。后台列表通常只需使用以下字段：

| 对象          | 推荐使用字段                                                                                    | 用途                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `user`        | `id`, `userNo`, `nickname`, `realName`, `mobile`, `avatar`, `city`, `status`                    | 客户信息                                                                        |
| `employee`    | `id`, `employeeNo`, `position`, `department`, `status`                                          | 负责人信息；注意员工姓名需要结合其用户账号，但当前 `employee` 未继续包含 `user` |
| `plan`        | `id`, `name`, `summary`, `startingPrice`, `cover`, `status`                                     | 当前方案信息                                                                    |
| `case`        | `id`, `title`, `city`, `roomType`, `area`, `style`, `totalPrice`, `status`                      | 关联案例信息                                                                    |
| `followUps[]` | `id`, `employeeId`, `content`, `nextFollowAt`, `createdAt`                                      | 跟进摘要或详情                                                                  |
| `project`     | `id`, `projectNo`, `name`, `customerName`, `mobile`, `quotedAmount`, `contractAmount`, `status` | 转化后的项目数据                                                                |

## 9. 后台列表页建议

建议表格列：

| 列名          | 取值建议                                                        |
| ------------- | --------------------------------------------------------------- |
| 预约编号      | `appointmentNo`                                                 |
| 预约类型      | `type` 映射中文                                                 |
| 客户          | `customerName ?? user.realName ?? user.nickname ?? "-"`         |
| 手机号        | `mobile`                                                        |
| 来源          | `source ?? "-"`                                                 |
| 预约方案/案例 | `snapshot.title ?? plan.name ?? case.title ?? "-"`              |
| 负责人        | 当前只能展示 `employee.employeeNo` 或岗位；员工姓名未随接口返回 |
| 状态          | `status` 映射中文标签                                           |
| 最近跟进时间  | 对 `followUps[].createdAt` 取最大值                             |
| 提交时间      | `createdAt`                                                     |
| 操作          | 查看详情；当前控制器未提供分配、跟进、状态修改等操作接口        |

前端 TypeScript 类型（列表对接精简版）：

```ts
type AppointmentType =
  'BUDGET' | 'MEASURE' | 'QUOTE' | 'PLAN' | 'CASE' | 'OUTLET'

type AppointmentStatus =
  'PENDING_CONTACT' | 'PENDING_VISIT' | 'COMPLETED' | 'CANCELED'

interface AppointmentListResponse {
  code: 200
  message: 'success'
  data: {
    list: AppointmentListItem[]
    total: number
    pageNum: number
    pageSize: number
    totalPage: number
  }
}

interface AppointmentListItem {
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
  followUps: Array<Record<string, unknown>>
  project: Record<string, unknown> | null
}

interface AppointmentSnapshot {
  title: string
  cover: string | null
  referencePrice: string
  items: Array<{
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
  }>
}
```

## 10. 错误响应

查询参数缺失、类型不正确或携带未声明参数时，NestJS 全局校验会返回 HTTP `400`。错误响应不会经过成功响应拦截器包装，通常类似：

```json
{
  "message": ["pageNum must be a string"],
  "error": "Bad Request",
  "statusCode": 400
}
```

## 11. 当前接口限制与联调注意事项

1. **预约类型筛选为可选。** 传入具体 `type` 时按指定预约类型查询，列表与总数使用相同条件；传 `ALL` 或不传时返回全部预约类型。
2. **其他筛选和搜索暂未提供。** 当前支持 `pageNum`、`pageSize`、`type`；状态、手机号、预约编号、负责人、时间范围等参数均不可传。
3. **暂无显式排序。** Prisma 查询未配置 `orderBy`，数据库返回顺序不应被前端当作稳定顺序。若后台要求最新预约优先，需要后端增加 `orderBy: { createdAt: 'desc' }`。
4. **关联数据返回过多。** `user` 当前包含完整用户标量字段，包括 `password` 和 `openid`。即使密码存储为哈希，也不应暴露给后台列表响应；建议后端改用 `select` 明确允许返回的字段。
5. **跟进记录未排序。** `followUps` 没有 `orderBy`；前端若展示最近跟进，需自行按 `createdAt` 比较，或由后端明确排序并只返回最近一条。
6. **员工姓名无法直接展示。** `employee` 没有继续包含关联的 `user`，只能拿到员工编号、岗位、部门等字段。
7. **列表负载偏大。** 当前每条记录带完整用户、方案、案例、全部跟进记录和项目，数据量上升后可能影响响应速度。更合适的做法是列表接口返回精简字段，详情接口再返回完整信息。
8. **分页参数校验不完整。** 非数字字符串、负数或过大的 `pageSize` 可能导致异常或性能问题，建议后端将 DTO 改为数字类型并增加 `@IsInt()`、`@Min(1)` 和合理的最大页容量限制。
