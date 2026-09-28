# 员工业绩概览

GET /api/employee/performance/summary，Authorization: Bearer <token>，无参数，仅有效员工。

返回标准 code/message/data。data 包含 month、signedCustomerCount、signedAmount、completedProjectCount、companyRank。

- 按北京时间本月 completedAt 统计当前员工 COMPLETED 项目。
- signedCustomerCount 为项目手机号去除首尾空白后的去重客户数，空手机号不计。
- signedAmount 为已完工项目 contractAmount 合计，元，两位小数字符串；空金额按零。
- completedProjectCount 为同范围项目数量。
- companyRank 按所有有效员工的同月已完工金额降序计算，无业绩按零，同额并列 1、1、3；只有一个有效员工时排名为 1。
- 有效员工指员工启用、关联用户启用且角色为 EMPLOYEE。
- 不再依赖 quoteConfirmedAt；该字段和确认时间写入流程保留。
- 概览与业绩中心金额、完成数量、排名保持相同口径，详见 employee-performance-center.md。

未登录 401，非有效员工 403。沿用全局响应格式。
本次无新增迁移，不修改历史项目数据。
