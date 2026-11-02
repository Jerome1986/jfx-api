# 商品 SKU 接口接入

## 当前状态

商品价格和库存由 `ProductSku` 独立管理，所有规格共用商品主图 `Product.mainImage`，SKU 不再接受或返回 `image`。购物车、订单明细、库存流水已增加必填 SKU 关联。

本地 `jfx` 数据库已执行 `20261020000000_add_product_sku` 并登记，Prisma Client 已生成。该迁移只适用于商品、购物车、订单明细、库存流水已清空的环境。其他历史迁移登记仍有差异，本次未重放它们。

后续迁移 `20261020010000_remove_sku_image` 移除 SKU 图片字段，保留商品主图及历史订单图片快照。

规格直接使用 SKU 的 `name` 表示，不再维护属性对象。只有一种规格时，在 `skus` 中提交一项即可，例如名称“默认规格”或具体尺寸。

## 商品接口

路径保持不变：

- `POST /product/add`：创建商品及至少一个 SKU。
- `PATCH /product/:id`：修改公共字段，或通过 `skus` 增加、修改规格。
- `GET /product`、`GET /product/category/:categoryId`、`GET /product/web/search`、`GET /product/:id`：返回 `skus`，按 `sort`、`id` 排序。
- `DELETE /product/:id`：删除无交易和业务引用的商品及 SKU；已有交易记录应下架商品。

创建请求示例：

```json
{
  "categoryId": 1,
  "name": "龙头",
  "unit": "个",
  "mainImage": ["/uploads/product.jpg", "/uploads/product-2.jpg"],
  "isPublished": true,
  "skus": [
    {
      "name": "拉丝款",
      "price": 299,
      "stock": 10,
      "isEnabled": true,
      "sort": 0
    },
    {
      "name": "枪灰款",
      "price": 359,
      "stock": 5
    }
  ]
}
```

编辑时 `skus` 为完整列表：带 `id` 更新，不带 `id` 新增；未包含的旧 SKU 自动软删除。创建和编辑均必须至少保留一个 SKU，提交 `skus: []` 返回 400；省略 `skus` 则保留原列表。停用规格提交 `isEnabled: false`。

软删除的 SKU 不再出现在商品或方案响应中，不能重新提交旧 ID 编辑或用于下单；历史订单、库存流水保留，取消原订单仍可返库存。删除后可重新创建同名规格。部署前执行 `20261021000000_soft_delete_product_sku` 迁移并重新生成 Prisma Client。

商品单位使用商品级 `unit` 字段，所有 SKU 共用，例如“件”“个”“套”“台”。创建时可省略，默认“件”；修改时省略则保留原值。传入时必须是包含非空白字符的字符串，最多 32 个字符，不接受 `null`。商品列表、搜索和详情响应均返回 `unit`。

部署前需执行迁移 `20261020030000_add_product_unit` 并重新生成 Prisma Client；历史商品单位自动填充为“件”，可再按实际情况修改。

商品响应不再提供商品级 `price`、`stock`、`specifications`。前端列表展示价可取启用 SKU 最低价，库存可汇总启用 SKU；选规格后切换价格、库存，图片始终使用商品主图。`inStock=true` 表示存在启用且有库存的 SKU，`false` 表示不存在此类 SKU。

初始化库存、人工调整库存均写流水；更新失败会回滚整个事务。提交库存为目标库存值。SKU 名称最多 191 字符，与订单规格快照字段兼容。

## 下单和取消

`POST /order/confrimOrder` 保留原拼写，收货、预约、优惠券、积分参数不变。明细改为：

```json
{
  "items": [
    { "productId": 1, "skuId": 1, "quantity": 2 },
    { "productId": 1, "skuId": 2, "quantity": 1 }
  ]
}
```

不再提交 `skuDescription`。服务端校验规格归属、启用状态、商品上架状态，读取真实售价。同一 SKU 重复明细合并检查和扣减库存。

订单列表和详情返回 `skuId` 及成交快照：商品名称、规格名称 `skuDescription`、图片 `image`、成交价 `unitPrice`、小计。新订单图片取下单时的商品主图；修改商品主图或 SKU 不改变历史订单。

`PATCH /order/:id/cancel` 及超时关闭按 SKU 返库存，重复取消不重复返还。停用 SKU 后取消未支付订单仍可返库存。

## 方案和购物车

`GET /renewal-plan`、`GET /renewal-plan/:id` 的 `items[].product.skus` 返回启用 SKU。方案仍关联商品，方案报价独立；前端选择 SKU 后下单。

当前没有独立购物车控制器。本次完成表级关联，唯一约束改为 `[userId, skuId]`，同一商品不同规格可分别加入。

## 验证

- TypeScript 检查通过。
- 商品查询 21 项测试通过，包括真实数据库筛选。
- `test/product-sku.integration-spec.ts` 验证商品增改查删、规格归属、不同价格、库存不足、下单扣库存、停用、历史快照、重复取消、购物车、方案查询，结束后事务回滚。
- 集成测试调用真实服务和数据库，微信支付及关闭订单使用 mock，未产生真实支付。
- 订单/支付/回调测试 197 项通过，1 项既有失败：支付回调为 1 分钱测试临时注释了金额一致性校验，与测试预期不一致。本次保留该行为。

```powershell
$env:RUN_PRODUCT_DB_TESTS = '1'
node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/product-sku.integration.jest.json --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/product-query.jest.json --runInBand
```
