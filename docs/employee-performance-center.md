# 员工业绩中心接口

GET /api/employee/performance/center，Authorization: Bearer <token>，仅有效员工。

参数：month 为 YYYY-MM，默认北京时间本月，all 为累计；pageNum 默认 1；pageSize 默认 10，最大 100。

## 统一统计口径

- 已完工即计入业绩：仅统计 COMPLETED 项目，月份使用 completedAt，不要求 quoteConfirmedAt 有值。
- 页面统一叫“签约金额”，取 contractAmount 合计；空金额按零，不用当前报价替代。
- 金额、完成数量、项目列表使用相同月份和员工范围。累计包含本人全部已完工项目；缺少完成时间的历史项目只进入累计。
- 平均单值 = 签约金额 / 完成项目数，无项目返回 0.00。signedProjectCount 保留字段，值等于 completedProjectCount。
- 所有有效员工参与排名：员工启用、关联用户启用且角色为 EMPLOYEE。无完工金额按零计算，只有一位员工就是第 1 名。
- 按金额降序，同额并列 1、1、3，同额按员工 ID 稳定排序；停用员工不参与。
- 首页概览与中心使用同一完工统计和排名口径；概览签约客户数按已完工项目手机号去重。
- 装修方案使用关联 plan.name，返回 planName；没有方案返回 null，前端显示“—”。不再拼接报价明细。

## 返回字段（统一包裹 code=200、message=success、data）

| data 字段 | 内容 |
| --- | --- |
| month | YYYY-MM 或 all |
| summary | signedAmount、signedProjectCount、completedProjectCount、averageSignedAmount、companyRank |
| totals | 本人累计 signedAmount、completedProjectCount，不随月份变化 |
| rankings | 前五位员工，每项 employeeId、name、rank、signedAmount |
| currentEmployee | 本人排名信息，字段同排行榜；前端避免重复展示 |
| projects | list、total、pageNum、pageSize、totalPage |

金额均为元、两位小数字符串。项目 list 每项：id、name、customerName、mobile（脱敏）、signedAmount、planName、completedAt。

项目按 completedAt、id 倒序分页，查看详情复用 GET /api/employee/projects/:id。月份按北京时间，包含月初、不包含下月月初。

错误：400 参数无效，401 登录失效，403 非有效员工。

## 发布与验证

本次为查询逻辑和字段调整，无新增数据库迁移；前后端需一起更新，前端已使用 planName。
历史 quoteConfirmedAt 字段和写入逻辑保留，但不再影响业绩统计。

验证：pnpm exec jest --config test/employee-performance-center.jest.json --runInBand；pnpm build。
真实数据库集成测试仍需独立测试数据库权限；本次未执行业务库迁移或修改历史数据。
