import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { productCoverImage } from '../utils/product-image.util'

const pipe = new ValidationPipe({ transform: true, whitelist: true })
const base = { categoryId: 1, name: '商品', skus: [{ name: '默认', price: 10, stock: 1 }] }

describe('商品轮播主图', () => {
  it.each([CreateProductDto, UpdateProductDto])('新增和更新保留图片顺序：%p', async (metatype) => {
    const mainImage = ['/second.jpg', '/first.jpg']
    await expect(pipe.transform({ ...base, mainImage }, { type: 'body', metatype }))
      .resolves.toHaveProperty('mainImage', mainImage)
  })

  it.each([null, [], '/cover.jpg', [''], ['   '], [1], ['/valid.jpg', null], ['x'.repeat(501)]].map(value => [value]))('拒绝非法主图 %p', async (mainImage) => {
    for (const metatype of [CreateProductDto, UpdateProductDto]) {
      await expect(pipe.transform({ ...base, mainImage }, { type: 'body', metatype })).rejects.toThrow()
    }
  })

  it('新增必填，局部更新允许省略主图', async () => {
    await expect(pipe.transform(base, { type: 'body', metatype: CreateProductDto })).rejects.toThrow()
    await expect(pipe.transform({ name: '新名称' }, { type: 'body', metatype: UpdateProductDto })).resolves.toBeDefined()
  })

  it('封面取第一张，空数组返回空字符串', () => {
    expect(productCoverImage(['/cover.jpg', '/banner.jpg'])).toBe('/cover.jpg')
    expect(productCoverImage([])).toBe('')
  })
})
