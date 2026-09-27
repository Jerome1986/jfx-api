# 未支付订单再次支付

## 请求与响应

`POST /api/order/:id/pay`，无需请求体。请求头：`Authorization: Bearer <用户 token>`。

`id` 是数据库订单 ID（不是商户订单号），必须为 1～2147483647 的整数。仅支持登录客户端用户自己的未支付商品订单，管理员不能代付。

```bash
curl -X POST "http://localhost:3000/api/order/123/pay" \
  -H "Authorization: Bearer <用户 token>"
```

成功返回 HTTP 200：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "timeStamp": "1790000000",
    "nonceStr": "随机字符串",
    "packageValue": "prepay_id=微信返回的预支付ID",
    "signType": "RSA",
    "paySign": "支付签名",
    "orderId": 123
  }
}
```

字段与首次支付接口一致。金额、用户微信身份及商户订单号均来自服务端；传入请求体中的金额或用户信息不会用于支付。

## 小程序调用示例

示例中的 `apiBase` 为服务地址（不含 /api），`token` 为客户端用户令牌。`refreshOrderDetail(orderId)` 由前端实现，调用 `GET /api/order/detail/:id` 并更新页面。

```javascript
wx.request({
  url: apiBase + '/api/order/' + orderId + '/pay',
  method: 'POST',
  header: { Authorization: 'Bearer ' + token },
  success(res) {
    if (res.statusCode !== 200 || res.data.code !== 200) {
      wx.showToast({ title: res.data.message || '暂时无法支付', icon: 'none' })
      refreshOrderDetail(orderId)
      return
    }
    const payment = res.data.data
    wx.requestPayment({
      timeStamp: payment.timeStamp,
      nonceStr: payment.nonceStr,
      package: payment.packageValue,
      signType: payment.signType,
      paySign: payment.paySign,
      fail(error) {
        if (error.errMsg !== 'requestPayment:fail cancel') {
          wx.showToast({ title: '支付未完成，请刷新订单后重试', icon: 'none' })
        }
      },
      complete() {
        refreshOrderDetail(orderId)
      },
    })
  },
  fail() {
    wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
  },
})
```

前端必须将 `packageValue` 映射为微信要求的 `package`。取消收银台后可以再次调用本接口。前端支付成功回调不直接修改订单状态，实际入账仍由现有微信支付通知处理；通知可能稍晚到达，详情仍为待支付时应稍后刷新。

## 错误与重试

| HTTP 状态 | 含义 |
| --- | --- |
| 400 | 非法订单 ID、缺少微信 openid，或微信拒绝下单参数 |
| 401 | 未登录、令牌无效或过期 |
| 403 | 管理员代付或用户账号已禁用 |
| 404 | 订单不存在或不属于当前用户 |
| 409 | 本地订单非待支付、已有支付流水，或微信返回已支付、已关闭、订单号或参数冲突 |
| 503 | 微信请求超时、限流、服务异常、签名失败或缺少有效预支付参数；可稍后按原订单 ID 重试 |

本地订单须为 `PENDING_PAYMENT + UNPAID`，且 `paymentNo`、`paidAt` 均为空。微信调用结束后会再次校验本地状态。后续仍可能发生支付或取消，最终结果以微信交易和服务端订单状态为准。

每次调用均使用原商户订单号请求预支付参数，不创建新订单、不重算价格、不重复扣库存或积分、不重新占用优惠券。请求超时设为 10 秒；调用在数据库事务外完成。微信已关闭的订单不会自动重新打开，也不会生成新商户订单号。本接口不主动查单补账。

## 当前测试模式与验证

本次保留现有 **1 分钱支付模式**：订单服务仍传递数据库应付金额（转换为分），支付服务实际请求 `amount.total = 1`。首次支付及再次支付共用此逻辑，回调金额校验保持现状。

运行订单、支付及通知回归测试：

```bash
node node_modules/jest/bin/jest.js --config test/order-payment.jest.json --runInBand
npm run build
```

新增测试覆盖登录与权限、订单及账号状态、支付字段映射、重复与并发请求、请求期间取消或入账、微信冲突与超时。测试使用模拟微信请求，不产生真实扣款。

已知现有回归失败：`src/notify/notify.repository.spec.ts` 中“金额不一致时不写入”要求拒绝金额差异，而当前回调已注释该校验以允许 1 分钱测试；本次不改变该测试或回调规则。
