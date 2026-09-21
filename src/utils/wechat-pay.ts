import axios from 'axios'

// 请求微信V3支付
export async function createWechatPay(body, auth) {
  return axios.post(process.env.PAY_URL as string, body, { headers: { Authorization: auth }, proxy: false })
}

// 请求微信退款
export async function refundWxchatPay(body, auth) {
  return axios.post(process.env.REFUND_URL as string, body, {
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    proxy: false
  })
}

// 请求微信 Native 下单请求
export async function nativeWechatOrder(body, mchid, nonceStr, timestamp, serial_no, signature) {
  return axios.post(
    process.env.NATIVE_URL as string,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization':
          `WECHATPAY2-SHA256-RSA2048 ` +
          `mchid="${mchid}",` +
          `nonce_str="${nonceStr}",` +
          `timestamp="${timestamp}",` +
          `serial_no="${serial_no}",` +
          `signature="${signature}"`
      }
    }
  )
}

export function getPrivateKey() {
  return `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGEf3zleyYM++P
h182zF7RuNDosGJHQcIt3ToZBWjAiBz9pfYHKkouuky0gQehmFfbnPSxw0VoZGgo
3teTF/EN0faDFBxQbEfmnyZRAYyA1emqJoXyUzDWiYg2AXH0g7fLwXqqfLbJS5XI
h6wgAwjh6AGUAl9TFXlB1oB4Y+071eUuZeVIpcPwpROv8h++CnUY6tf8vCfyLkR2
MQwfg43xP9WthOJ9SbaGSokxhGlyCi/kE1UqxWer4WmHoT1EbRo2vuE9+8qOJDT2
iy5TP0194ym6sYgn3Vya0ccHQZbqifZCBjSSYlPsh2dQl0q1vntwh2fPmyOD5GdZ
/a4kv4aDAgMBAAECggEAaij+ie4TT0iW38DYwZAsSg/auLzBEBworVhjaUHC8V6C
21h2U0TRWdY0gpKdunjiriyj4hsdOmSGh1FZDdfJNXURwROoUVqX9v3aFZTU78C3
aqEXLdh01qgEP53qq/llK2paCsKpXZ6Le11sXgQCYMJvBht3aBqcUTNczCoS3vxG
U3uyaxKoFmBpxW6HCH8zW4VUIuZYNetE+gP2tyqfwxt9NlC5fSFnjSL9qxq6JjVv
ChSXqjaXAJK/ztqEC0Xhfbk1j80G8Gl8ImxaWxfqC2+XNBLDkwGKErj6NBK45cL0
C0g/lpdySDmc8FLpLsJevYKgh79/Et/7sYdNjS0MQQKBgQDmsyfgAg7fZoZ3vxkf
jktjg9dzXkvvXWeV2EfgneIKy3f4EjQ57F4Rs77nYOWKKk6bN61rR+3N1wjy1dC1
1IxXXV0eo/i1cd6wXxZQyczpCyYL0uYqyqbU+ImEPP0k8dSulWJSfxYNrcJ7DzRf
K6wq/TqoMT42Y65XDbVfFg2ucwKBgQDbysTwDB3q0HXNYlIFzi/Ulzaj+sKGLrBc
DGfFyT+CqySU9fqWiVlWrRD7odQUlAMy15q1yQasP0R4QdL062zvE27xMawLDpiZ
A27EUwSJ4mTw+/9CGAqTNJboIjo0qTJUaYPeHn/aU39IzK07jMk0RpIDil1I4TDm
SxC8oxMzsQKBgAGmpJFo0lxs6mdu+aoNJaL3rZIIybhTzcr3ukP0PUrge+JNlwwX
EfFEfQhA3EOp29gmhNowsJX5hPnf59d1Ru/VHjZ66+u4feR7ObioSQwd5U7OWpFR
0/HQOYO1wAYEqQX60bJPcIP2i17AFBreQCQqncHYYF6ZRgUfdv3QNZbbAoGBAImH
Z5ONAWtc5VmOnCRl0CgGNnqE/hNYQ6JVYNmyA7uPu2Q6RoLLjstdn7LUoBAATcAS
iQwWrcY6EG3vQkFeztsKHfFuU2jXyUR1kWnnSH++2cqw5BhHUtapoYO/ZwxsksGf
BJSIIRhMBulWqU8J2RyMy/DLM3PW9PIlJmPi5rEBAoGATuzDPCYZcVkznRUDGlIt
TNcGMknLEOlIutDjcOTXO1zph5kabJti91Hcu0h3/u86pQx/KwmDHgHUO5uMuEDW
jfXKdumWyY/SGtmte8ajHs58NbKQ4KzFEa3qRLbo7j4xzzIIsMBI7CUyL6fBfxuK
hCGyI6p6Pmjaku48l3GzaZ4=
-----END PRIVATE KEY-----`
}
