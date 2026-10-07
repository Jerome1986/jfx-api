# 后台工作台接口

## 汇总

`GET /api/dashboard/overview`，无参数。请求头 `Authorization: Bearer <管理员 token>`。
管理员必须存在且启用；本期统计全量数据，不按 `dataScope` 过滤。普通用户返回403，未登录返回401。

响应沿用 `{ code: 200, message: "success", data }`。data 包含：

- businessMetrics：依次返回 todayCustomers、todayAppointments、renovationProjects、productOrders、todayRevenue、monthRevenue、totalRevenue。元素包含 key、label、value、unit。
- businessStatuses：依次返回 appointmentPendingContact、appointmentPendingVisit、projectPendingConfirm、projectInService、orderPendingInstallation、projectCompleted。元素包含 key、label、count。
- alerts：异常分类汇总，包含 id、type、title、description、count、level、targetPath、query。仅返回 count > 0 的分类，没有异常时为 []。

日期按北京时间；单次请求使用同一个当前时间、同一事务快照。今日／本月从对应北京时间零点统计至当前时间。

新增客户为今日创建、当前角色CUSTOMER的用户；预约按创建时间，全部类型计入。项目数和商品订单数是累计数，包含已取消记录。业务状态按当前状态统计，不限定日期。

金额单位为元，返回 number，最多两位小数：
- 项目按 quoteConfirmedAt 归属期间，仅统计当前 IN_SERVICE、COMPLETED 项目的 contractAmount。历史确认时间为空的不计入今日／本月，但计入历史累计；取消项目从统计中移除。
- 商品按 paidAt 归属期间，支付状态为 PAID、REFUNDING、REFUNDED 时统计 paidAmount - refundAmount，空退款金额按0。后续退款回溯调整原支付期间。
- totalRevenue（历史累计成交金额）：不限制开始日期，统计截至当前时间的全部有效成交，包含今日和本月；状态与退款扣减沿用上述口径；确认／支付时间为空的历史已成交记录也计入累计，但不推算所属日期，不计入今日／本月。未来确认／支付记录不计入。无需新增数据库字段或迁移。
- 两者相加即成交金额，不等同于按收退款发生日计算的现金收入。

## 异常列表联动

| type | 规则 | level | targetPath | query.alertType |
| --- | --- | --- | --- | --- |
| APPOINTMENT_UNCONTACTED | 待联系且提交严格超过2小时 | danger | /renovation/appointment | uncontacted |
| APPOINTMENT_UNASSIGNED | 负责人为空且待联系或待上门 | warning | /renovation/appointment | unassigned |
| PROJECT_OVERDUE | 计划日期早于北京时间今天，项目未完成、未取消 | danger | /renovation/projects | overdue |
| INSTALLATION_OVERDUE | 已支付、待安装或服务中，安装单未完成未取消，严格超过预约时段结束时间 | warning | /trade/orders | overdue |
| FEEDBACK_UNHANDLED | PENDING且提交严格超过24小时 | warning | /support/feedback | overdue |

提醒ID固定为 alert-appointment-uncontacted、alert-appointment-unassigned、alert-project-overdue、alert-installation-overdue、alert-feedback-unhandled。

对应接口：
- GET /api/appointment?alertType=uncontacted 或 unassigned
- GET /api/project?alertType=overdue
- GET /api/order/all?alertType=overdue
- GET /api/feedback/all?alertType=overdue

继续传 pageNum、pageSize，保留各接口现有分页响应。异常条件与其他条件取交集，total为过滤后的总数；非法alertType返回400。只有相同时间、相同附加筛选下，汇总count才与列表total一致。

预约接口：管理员查询全量，普通用户无alertType时仍只查询本人；普通用户传异常筛选返回403。order/all、feedback/all补齐管理员鉴权。用户端mine接口不接受后台异常参数。

前端需读取路由query并传入列表请求，首次异常跳转应清除会冲突的原状态／日期筛选，重置pageNum；本仓库不修改前端页面。

## 项目日期与安装时间

后台新增／编辑项目请求增加可选 plannedCompletionDate，格式YYYY-MM-DD，允许null。编辑不传保留原值，null清除；项目列表和详情返回日期字符串或null。当天不计逾期，次日北京时间零点起才计入。历史和预约转入项目默认null，可通过现有编辑接口补录。

安装单scheduledEndAt由服务端按预约日期和时段结束时间计算UTC值；支付成功创建安装单时填写，不接受前端直接设置。历史有效时段由迁移回填，缺失或非法时段保留null，不计入逾期。

## 部署和验证

先执行数据库迁移 `20261006010000_add_dashboard_dates`，再发布新代码。迁移增加两个可空日期字段、两组索引并回填安装结束时间，不推算项目计划日期。

```sh
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm build
pnpm exec jest --config test/dashboard.jest.json --runInBand
```

迁移集成测试需提供有建库权限的 `DASHBOARD_TEST_SERVER_URL`，执行：

```sh
pnpm exec jest --config test/dashboard.integration.jest.json --runInBand
```

测试仅创建和清理随机命名的jfx_dashboard_test_*隔离库，验证MySQL迁移、时区回填、空值和索引。未设置环境变量时跳过；不会在业务库执行迁移。
