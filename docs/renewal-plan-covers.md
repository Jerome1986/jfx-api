# 焕新方案封面数组

- POST /renewal-plan/add 和 PATCH /renewal-plan/:id 的 cover 为 string[]，不接受字符串、null 或空白图片地址。
- 新增省略 cover 时保存 []；更新省略时保留原值，传 [] 时清空。管理后台保存要求至少一张。
- GET /renewal-plan 和 GET /renewal-plan/:id 返回 cover 数组，顺序即展示顺序。
- 列表、跳转缩略图、项目方案候选和预约快照取第一张；详情轮播展示全部封面。images 仍为独立详情图片，shareImage 仍为单图。
- 数据库迁移：20261101000000_renewal_plan_cover_array。仅修改 renewal_plan.cover 为 JSON，前提是旧测试方案已删除。不执行历史转换。
- 三端需协调上线，不兼容旧字符串格式。
