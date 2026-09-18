# 员工取消装修项目

`PATCH /api/employee/projects/:id/cancel`，沿用 Bearer 登录鉴权及标准响应包装。

```json
{ "reason": "客户暂缓装修，已电话沟通确认", "expectedStatus": "PENDING_CONFIRM" }
```

原因先 trim，必填，长度 1～500。expectedStatus 必填，仅允许 PENDING_CONFIRM / IN_SERVICE，取打开弹窗时的状态。不得提交员工、客户 ID 或线下协商勾选字段；线下协商勾选由前端在服务中取消时控制。

只有有效负责员工可取消。数据库原子条件包含项目 ID、负责人、expectedStatus。成功写入 CANCELED、cancelReason、canceledAt、canceledByEmployeeId（员工 ID 快照），自动更新 updatedAt，返回与员工项目详情相同的关联结构。保留报价、版本、明细、合同金额、来源预约及进度，不取消预约、不创建新项目。

员工与客户查询自动包含取消记录。已有 ALL 查询包含 CANCELED；工作概览按当前状态实时统计，取消后自动退出待确认/服务中计数。取消后现有确认、报价修改、完工接口均拒绝操作。

400 参数错误；401 登录失效；403 员工不可用；404 项目不存在或无权访问；409 状态或归属变化、重复取消。409 后关闭弹窗并刷新，不自动重试。成功后重新加载详情与工作概览。

发布前执行 `pnpm exec prisma migrate deploy` 和 `pnpm exec prisma generate`，重启后端。验证迁移成功后，小程序启用 PROJECT_CANCEL_API_ENABLED。

单元回归：`pnpm exec jest --config test/project-quote.jest.json --testRegex '.*\.spec\.ts$' --runInBand`。
