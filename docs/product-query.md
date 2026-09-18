# 商品查询 GET /product

以下路径省略全局 `/api` 前缀。返回仍由统一拦截器包装为 `{ code, message, data }`。

| 参数 | 规则 |
| --- | --- |
| keyword | 可选，去首尾空格；名称、品牌、型号、描述任一包含匹配，空字符串不筛选。数据库字段使用不区分大小写的 collation。 |
| categoryId | 可选，正整数，精确匹配商品分类 ID。不是“主材/辅材”等明细分类文字。 |
| isPublished | 可选，显式解析 `true` / `false`，不传包含全部状态。 |
| inStock | 可选，`true` 表示库存大于 0，`false` 表示库存不大于 0，不传不筛选库存。 |
| pageNum | 可选，正整数，传分页参数时默认 1。 |
| pageSize | 可选，1～100，传分页参数时默认 10。 |

不同条件之间为 AND，关键词的四个字段之间为 OR。非法参数返回 400。

## 按分类查询商品

`GET /api/product/category/12?isPublished=true&pageNum=1&pageSize=10`

路径中的分类 ID 必须为正整数，精确匹配商品所属分类，不包含子分类商品。
支持上述筛选和分页参数，分类以路径中的 ID 为准。返回结构与商品列表一致；
不传分页参数时返回数组，传任一分页参数时返回分页对象。分类不存在或没有商品时返回空列表。
不传 `isPublished` 时仍包含全部上下架状态。

## 后台管理与旧调用方

`GET /product?keyword=空调&categoryId=12&isPublished=false`

不传 pageNum 和 pageSize 时，data 保持商品数组，包含原有 category 关联。
无筛选条件时仍按 sort 升序、createdAt 降序返回全部商品；没有结果返回 `[]`。

## 小程序商品替换

`GET /product?keyword=空调&isPublished=true&inStock=true&pageNum=1&pageSize=10`

传任一分页参数即返回：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [],
    "total": 0,
    "pageNum": 1,
    "pageSize": 10,
    "totalPage": 0
  }
}
```

分页商品字段不变。排序在原规则后追加 id 降序，保证同排序值、同创建时间的数据有确定顺序。
列表和总数在 RepeatableRead 事务中使用同一筛选条件。跨请求期间目录发生变更时，偏移分页不是固定快照；小程序追加时按商品 ID 防重。

小程序搜索会重置页码，加载失败可重试当前页，到最后一页停止追加。
当前替换入口没有传入商品目录 categoryId，继续保留当前明细的分类、单位和数量，不推测文字分类与目录 ID 的映射。
施工服务替换不属于本次变更。

## 验证

单元测试：`node node_modules/jest/bin/jest.js --config test/product-query.jest.json --runInBand`。
本地数据库集成测试：设置 `RUN_PRODUCT_DB_TESTS=1`，并给 Node 添加 `--experimental-vm-modules`；测试使用 PrismaService 的数据库配置，测试商品和分类在事务结束时回滚。
