# 安装完工与客户确认

实际 URL 包含全局前缀 `/api`，以下省略此前缀。

## 后台报完工

`PATCH /order/:id/complete`，管理员登录，无请求体。

仅服务中订单可操作。同一事务中将安装单设为 COMPLETED 并填写安装完工时间，
商品订单改为 PENDING_CONFIRMATION，确认截止时间为安装完工后 7 × 24 小时。
不填写商品订单 completedAt，不修改 customerConfirmed。

返回：`{ "code": 200, "message": "安装已完工，待客户确认", "data": null }`。

重复报完工返回冲突，不重置截止时间。

## 客户确认

`PATCH /order/:id/confirm-completion`，客户端 CUSTOMER 登录，无请求体。

仅能操作自己的 PENDING_CONFIRMATION 订单。订单必须已支付、没有退款金额，
且关联安装单已完工、尚未客户确认。
同一事务中完成订单，记录 completedAt、completionType=CUSTOMER_CONFIRMED，
并设置安装单 customerConfirmed=true、customerConfirmedAt。
保留 installation.completedAt（安装实际完工时间）。

返回：`{ "code": 200, "message": "订单已确认完成", "data": null }`。

其他客户的订单返回 404；非客户角色返回 403；状态变化或不符合条件返回 409。
客户确认截止后，只要自动任务尚未完成订单，客户仍可主动确认。

## 超时自动完成

每分钟扫描到期的待确认订单，按 ID 分页，每页 100 条。
仅自动完成未暂停、已支付、无退款金额且安装单已完成、尚未客户确认的订单。
事务内重新检查相同条件，写入 COMPLETED、completedAt、completionType=AUTO_TIMEOUT。
保留 customerConfirmed=false、customerConfirmedAt=null，不变更安装完工时间。

客户确认、自动完成通过订单条件更新竞争，只有一方能够成功。
单条失败记录日志，下轮重试，不影响后续订单；服务重启后扫描也能补处理已到期订单。

## 线下争议暂停自动完成

`PATCH /order/:id/auto-completion`，管理员登录。

请求：`{ "paused": true }` 暂停，`{ "paused": false }` 恢复。仅待确认订单允许操作。
响应消息分别为“已暂停自动完成”和“已恢复自动完成”，code=200、data=null。

项目暂无独立售后/争议模块，线下争议需管理员调用暂停接口。
暂停只阻止自动完成，客户仍可主动确认；恢复不延长原截止时间，
若已到期，下轮扫描即可自动完成。退款状态或已有退款金额的订单始终排除。
未来售后模块须在受理争议时同步暂停标记，或将订单转入退款状态。

## 列表和详情

现有订单查询返回全部订单标量字段及 installation，无需额外拼接：
- 订单：confirmationDeadlineAt、completionType、autoCompletionPaused、completedAt。
- installation：customerConfirmed、customerConfirmedAt、completedAt。
- 列表状态筛选支持 PENDING_CONFIRMATION。

前端后台按钮改为“确认安装完工”；客户端新增“确认完成”按钮并展示截止时间。
本次仅实现后端。

## 数据库部署

先执行迁移，再启动新版应用：
`pnpm exec prisma migrate deploy`
`pnpm exec prisma generate`

确认迁移连接与运行时 PrismaService 连接指向同一个数据库。
新增迁移为 20260921010000_add_order_completion_confirmation；
旧完工记录保持 COMPLETED，completionType 和新增确认时间字段保持 null，
不推断历史完成方式，也不会被超时任务扫描。
