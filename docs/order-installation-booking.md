# 用户订单安装预约契约

## 下单

POST /api/order/confrimOrder（沿用现有路由拼写），需用户 Bearer Token。
在原请求上增加两个必填字段：

```json
{
  "appointmentDate": "2026-09-25",
  "timeSlot": "09:00-12:00"
}
```

- appointmentDate 是 Asia/Shanghai 的日历日期，仅接受 YYYY-MM-DD 和真实日期。
- timeSlot 是北京时间的同一天时段，格式 HH:mm-HH:mm，结束必须晚于开始。
- 时段开始时间必须晚于提交时的当前时间；不接受跨午夜时段。
- 缺失、格式错误、无效日期、已开始的时段返回 400，不创建订单或发起支付。
- remark 仅保存用户留言，不承载预约信息；后端不解析历史备注来猜测预约时间。
- 日期存入订单的 DATE 字段；应用中的 UTC 午夜仅用于承载日历日期，不表示实际上门时刻。

创建响应沿用统一 code/message/data 包装。data 保留现有支付参数，并增加 orderId：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "orderId": 15,
    "timeStamp": "...",
    "nonceStr": "...",
    "packageValue": "prepay_id=...",
    "signType": "RSA",
    "paySign": "..."
  }
}
```

前端保存 orderId 和支付参数，用户取消微信支付后继续付款应复用该订单，不能重新调用创建接口；已提交的预约信息不再由结算页修改。

## 列表和详情

GET /api/order/user 与 GET /api/order/detail/:id 的订单对象均返回：

- appointmentDate：直接返回数据库日期，由 JSON 默认序列化为 ISO 时间字符串（例如 2026-09-25T00:00:00.000Z），空值为 null。
- timeSlot：HH:mm-HH:mm 或 null。
- installation：支付回调完成前通常为 null；完成后含 appointmentDate、timeSlot、status 等现有字段。
- createdAt、paidAt 等事件时间仍是原来的 ISO 时间戳，按北京时间展示。

新订单支付回调成功后：商品订单 status=PENDING_INSTALLATION、paymentStatus=PAID；安装服务单 status=PENDING_ASSIGNMENT，并复制下单保存的日期与时段。
支付回调不重新校验预约时间是否已过去，避免延迟通知导致已收款订单无法入账。

微信客户端支付成功后进入 orderId 对应详情，依据服务端 paymentStatus 确认结果。回调未到达时保留“支付结果确认中”，不要当作支付失败或重新下单。轮询与页面跳转由前端实现。

历史订单新增字段为 null，不自动补日期。缺少完整预约信息的历史订单支付后仍为 PENDING_APPOINTMENT，前端展示“安装时间待确认”，不能展示为待派单。既有安装单不被迁移改写。

## 数据库变更

迁移：20260920000000_add_order_installation_booking，仅为 product_order 新增 appointment_date DATE NULL 与 time_slot VARCHAR(11) NULL。
部署到其他环境时应用此迁移，并运行 prisma generate 后构建服务。
