# 后台员工业绩分页接口

`GET /api/admin/employee/performance`

请求头：`Authorization: Bearer <token>`。仅数据库中仍启用的管理员可访问，所有有效管理员均可查看。与小程序接口独立，沿用当前业绩中心的完工统计口径。

## 请求参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| month | string | YYYY-MM 或 all，默认北京时间本月，all 表示累计 |
| pageNum | number | 默认 1，正整数，最大 2147483647 |
| pageSize | number | 默认 10，1～100 |
| keyword | string | 去除首尾空白，员工编号、岗位、真实姓名或手机号模糊搜索，不区分大小写 |
| department | string | 部门精确匹配 |
| status | boolean | true/false，按员工档案启用状态筛选；不传包含全部 |

示例：`GET /api/admin/employee/performance?month=2026-09&pageNum=1&pageSize=10`

## 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "month": "2026-09",
    "list": [
      {
        "employeeId": 21,
        "employeeNo": "E021",
        "name": "张三",
        "mobile": "13800000000",
        "department": "设计部",
        "position": "设计师",
        "status": true,
        "isActive": true,
        "signedCustomerCount": 8,
        "signedAmount": "180000.00",
        "completedProjectCount": 10,
        "averageSignedAmount": "18000.00",
        "companyRank": 3
      }
    ],
    "total": 1,
    "pageNum": 1,
    "pageSize": 10,
    "totalPage": 1
  }
}
```

- name 依次使用真实姓名、昵称、“员工”；mobile 是员工手机号。department、position 可为 null。
- status 为员工档案状态；isActive 要求员工启用、关联用户启用且角色为 EMPLOYEE。
- 所有金额单位为元，返回两位小数字符串；signedAmount 沿用小程序命名，实际为已完工项目合同金额。

## 统计与排名

仅统计当前负责人关联的 COMPLETED 项目，取消和服务中项目不参与。月份按北京时间 completedAt 左闭右开过滤；累计不限制完成时间，包含缺少完成时间的历史已完工项目，不依赖 quoteConfirmedAt。

客户数按各员工项目手机号去除首尾空白后去重，忽略空号码。同一客户的每个项目金额均计入；合同金额为空按零，不使用当前报价替代。平均单值 = 合同金额合计 / 完工项目数，无项目返回 0.00。

列表包含停用和零业绩员工，按金额降序、员工 ID 升序分页。total 为筛选后的员工数，超出末页返回空 list；空结果 totalPage 为 0。

公司排名始终按全公司有效员工计算，关键词、部门、状态和分页不改变名次。有效员工零业绩仍参与排名，同额为 1、1、3；非有效员工 companyRank 为 null，因此列表顺序不一定等于公司排名顺序。仅按单公司系统处理，不引入新的角色或数据权限体系。

查询在同一个 RepeatableRead 只读事务快照中完成。读取员工必要字段和按员工汇总的金额、数量；服务层完成排名、筛选和分页；仅查询当页员工的项目手机号分组，无逐员工数据库查询。

## 错误与验证

- 400：月份、分页、状态参数不合法或传入未定义参数。
- 401：未登录、令牌无效或过期。
- 403：员工/客户身份访问，或管理员档案缺失、停用。
- 数据库异常正常返回错误，不用零业绩掩盖失败。

验证命令：

```sh
pnpm exec jest --config test/admin-employee-performance.jest.json --runInBand
pnpm exec jest --config test/employee-performance-center.jest.json --runInBand
pnpm build
```

本次只新增后端分页接口，无数据库迁移；不修改小程序接口行为，不提供汇总卡片、导出或员工项目明细。
