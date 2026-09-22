import 'reflect-metadata'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { AdminQuoteItemDto } from './dto/admin-project.dto'
import { CreateProjectQuoteItemDto } from '../employee/dto/create-project.dto'

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
})
const base = {
  category: '主材',
  name: '商品或服务',
  unitPrice: '50.00',
  quantity: '20',
}

describe.each([AdminQuoteItemDto, CreateProjectQuoteItemDto])(
  '%s 商品与服务单位兼容校验',
  (dto) => {
    const validate = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: dto })

    it.each([undefined, null, '', '   '])('商品允许空单位 %j', async (unit) => {
      await expect(
        validate({ ...base, productId: 100, unit }),
      ).resolves.toMatchObject({ productId: 100 })
    })

    it('旧商品报价带单位仍接受，单位快照不会被清空', async () => {
      expect(
        await validate({ ...base, productId: 100, unit: ' 个 ' }),
      ).toMatchObject({ unit: '个' })
    })

    it.each([undefined, null, '', '   ', 1])(
      '服务拒绝空或非法单位 %j',
      async (unit) => {
        await expect(
          validate({ ...base, serviceId: 8, unit }),
        ).rejects.toBeInstanceOf(BadRequestException)
      },
    )

    it('服务支持计价单位', async () => {
      expect(
        await validate({ ...base, serviceId: 8, unit: ' ㎡ ' }),
      ).toMatchObject({ serviceId: 8, unit: '㎡' })
    })

    it.each([undefined, null, '', ' '])(
      '旧无关联明细仍要求单位 %j',
      async (unit) => {
        await expect(validate({ ...base, unit })).rejects.toBeInstanceOf(
          BadRequestException,
        )
      },
    )

    it('旧无关联人工明细继续兼容', async () => {
      expect(
        await validate({ ...base, category: '人工', unit: '项' }),
      ).toMatchObject({ unit: '项' })
    })

    it.each([{}, { unit: null }])(
      '不允许同时关联商品和服务 %j',
      async (patch) => {
        await expect(
          validate({
            ...base,
            productId: 100,
            serviceId: 8,
            unit: '㎡',
            ...patch,
          }),
        ).rejects.toBeInstanceOf(BadRequestException)
      },
    )

    it.each([-1, 0, 1.5, '8', 2147483648])(
      '拒绝非法服务 ID %j',
      async (serviceId) => {
        await expect(
          validate({ ...base, serviceId, unit: '㎡' }),
        ).rejects.toBeInstanceOf(BadRequestException)
      },
    )

    it('商品单位如果提交也需要合法字符串', async () => {
      await expect(
        validate({ ...base, productId: 100, unit: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  },
)
