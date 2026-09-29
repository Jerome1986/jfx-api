import crypto from 'crypto'

// 使用 API 密钥、随机串和附加数据执行 AES-256-GCM 解密，校验认证标签后返回解析的 JSON。
export function decryptWechatData(key, associated_data, ciphertext, nonce) {
  const ctBuffer = Buffer.from(ciphertext, 'base64')

  const authTag = ctBuffer.subarray(ctBuffer.length - 16)
  const content = ctBuffer.subarray(0, ctBuffer.length - 16)

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'utf8'),
    Buffer.from(nonce, 'utf8'),
  )

  decipher.setAuthTag(authTag)

  if (associated_data) {
    decipher.setAAD(Buffer.from(associated_data, 'utf8'))
  }

  let decoded = decipher.update(content, undefined, 'utf8')
  decoded += decipher.final('utf8')

  const result = JSON.parse(decoded)

  return result
}
