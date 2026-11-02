# 商品主图数组

新增、编辑商品的 `mainImage` 改为非空字符串数组，详情和列表按保存顺序返回该数组。

```json
{ "mainImage": ["/uploads/cover.jpg", "/uploads/banner-2.jpg"] }
```

每个地址不能为空白，最长 500 字符。新增时必填；编辑时省略表示不修改，不能传 `null` 或空数组。前端轮播直接遍历 `mainImage`，封面取 `mainImage[0]`。订单图片快照和焕新方案的 `image` 仍是第一张图片的字符串。

部署前须应用 `20261026000000_product_main_image_array` 迁移并重新生成 Prisma Client。迁移将已有字符串通过 `JSON_ARRAY` 转为单元素数组，保留原地址。前后端须同步切换字段类型；旧的字符串请求将不再通过校验。
