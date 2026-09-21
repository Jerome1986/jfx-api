import crypto from 'crypto'

// 解密函数
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
