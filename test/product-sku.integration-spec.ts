import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { PrismaService } from '../src/prisma/prisma.service'
import { ProductRepository } from '../src/product/product.repository'
import { OrderRepository } from '../src/order/order.repository'
import { OrderPreparationService } from '../src/order/order-preparation.service'
import { OrderService } from '../src/order/order.service'
import { RenewalPlanRepository } from '../src/renewal-plan/renewal-plan.repository'
import { CreateProductDto } from '../src/product/dto/create-product.dto'
import { CreateOrderDto } from '../src/order/dto/create-order.dto'

const integration = process.env.RUN_PRODUCT_DB_TESTS === '1' ? describe : describe.skip
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
const skuInput = (name: string, price: number, stock: number) => ({
  name, price, stock,
})

integration('SKU database flow (rollback)', () => {
  it('creates, edits, queries, orders and cancels independently by SKU', async () => {
    const db = new PrismaService()
    const rollback = new Error('ROLLBACK_SKU_TEST')
    try {
      await db.$transaction(async tx => {
        const scoped = new Proxy(tx, {
          get(target, key) {
            if (key === '$transaction') return async (operation: any) =>
              Array.isArray(operation) ? Promise.all(operation) : operation(tx)
            return Reflect.get(target, key)
          },
        }) as unknown as PrismaService
        const products = new ProductRepository(scoped)
        const orders = new OrderRepository(scoped)
        const preparation = new OrderPreparationService({} as never)
        const payment = { wxPay: jest.fn().mockResolvedValue({ paySign: 'mock' }), closeOrder: jest.fn() }
        const service = new OrderService(orders, preparation, payment as never, scoped)
        const category = await tx.productCategory.create({ data: { name: 'SKU integration' } })
        const user = await tx.user.create({ data: {
          userNo: `SKU${Date.now()}`, mobile: `sku${Date.now()}`, openid: `sku-test-${Date.now()}`,
        } })
        const input = await pipe.transform({
          categoryId: category.id, name: 'SKU integration product', mainImage: ['cover.jpg', 'banner.jpg'],
          isPublished: true, skus: [skuInput('red', 10.25, 5), skuInput('blue', 20.5, 8)],
        }, { type: 'body', metatype: CreateProductDto })
        const product = await products.create(input)
        const [red, blue] = product.skus
        expect(red.price.toString()).toBe('10.25')
        expect((await products.findAll({ categoryId: category.id, inStock: true }))[0].skus).toHaveLength(2)
        expect((await products.findByName(product.name, 1, 10))[1]).toBe(1)
        expect((await products.findPage({ categoryId: category.id, pageNum: 1, pageSize: 10 }))[1]).toBe(1)
        const other = await products.create({ ...input, name: 'Other', skus: [skuInput('default', 1, 1)] })
        await expect(products.update(other.id, { skus: [{ ...skuInput('red', 1, 1), id: red.id }] })).rejects.toThrow('不属于')
        await products.remove(other.id)
        await products.update(product.id, { skus: [{ ...skuInput('red', 10.25, 5), id: red.id }, { ...skuInput('blue', 20.5, 9), id: blue.id }] })
        expect((await products.findOne(product.id))!.skus[1].stock).toBe(9)
        const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
        const dto = await pipe.transform({
          contactName: 'SKU test', contactPhone: '123', serviceAddress: 'Test address',
          appointmentDate: tomorrow, timeSlot: '09:00-12:00',
          items: [
            { productId: product.id, skuId: red.id, quantity: 1 },
            { productId: product.id, skuId: red.id, quantity: 1 },
            { productId: product.id, skuId: blue.id, quantity: 1 },
          ],
        }, { type: 'body', metatype: CreateOrderDto }) as CreateOrderDto
        await expect(preparation.prepare({ ...dto, items: [{ productId: other.id, skuId: red.id, quantity: 1 }] }, user.id, tx)).rejects.toThrow('不属于')
        await expect(preparation.prepare({ ...dto, items: [{ productId: product.id, skuId: red.id, quantity: 6 }] }, user.id, tx)).rejects.toThrow('库存不足')
        const actor = { userId: user.id, type: 'user' as const, role: 'CUSTOMER' as const }
        const result = await service.confrimOrder(dto, actor)
        expect(payment.wxPay.mock.calls[0][3]).toBe(4100)
        const detail = await orders.findOneByUser(result.orderId, user.id)
        expect(detail!.items.map(item => item.skuId).sort()).toEqual([red.id, red.id, blue.id].sort())
        expect(detail!.items.find(item => item.skuId === red.id)!.image).toBe('cover.jpg')
        expect(detail!.items.find(item => item.skuId === red.id)!.unitPrice.toString()).toBe('10.25')
        expect((await products.findOne(product.id))!.skus.map(sku => sku.stock)).toEqual([3, 8])
        await products.update(product.id, { mainImage: ['new-cover.jpg'], skus: [{ ...skuInput('red', 99, 3), id: red.id, isEnabled: false }] })
        expect((await orders.findOneByUser(result.orderId, user.id))!.items.find(item => item.skuId === red.id)!.image).toBe('cover.jpg')
        await expect(preparation.prepare(dto, user.id, tx)).rejects.toThrow('不存在')
        await expect(preparation.prepare({ ...dto, items: [{ productId: product.id, skuId: red.id, quantity: 1 }] }, user.id, tx)).rejects.toThrow('已下架')
        expect((await orders.findOneByUser(result.orderId, user.id))!.items.find(item => item.skuId === red.id)!.unitPrice.toString()).toBe('10.25')
        await service.cancel(result.orderId, actor)
        await service.cancel(result.orderId, actor)
        expect((await products.findOne(product.id))!.skus.map(sku => sku.stock)).toEqual([5])
        expect(await tx.productSku.findUnique({ where: { id: blue.id } })).toMatchObject({ stock: 9, isEnabled: false, deletedAt: expect.any(Date) })
        await expect(products.update(product.id, { skus: [] })).rejects.toThrow('至少提供一个SKU')
        await expect(products.update(product.id, { skus: [{ ...skuInput('blue', 20.5, 9), id: blue.id }] })).rejects.toThrow('不属于')
        const replaced = await products.update(product.id, { skus: [{ ...skuInput('red', 99, 5), id: red.id, isEnabled: false }, skuInput('blue', 20.5, 9)] })
        const replacementBlue = replaced.skus.find(sku => sku.name === 'blue')!
        expect(replacementBlue.id).not.toBe(blue.id)
        expect(await tx.stockLog.count({ where: { productId: product.id, type: 'CANCEL_RELEASE' } })).toBe(2)
        await expect(products.remove(product.id)).rejects.toThrow('交易记录')
        await tx.cartItem.createMany({ data: [
          { userId: user.id, productId: product.id, skuId: red.id },
          { userId: user.id, productId: product.id, skuId: blue.id },
        ] })
        expect(await tx.cartItem.count({ where: { userId: user.id } })).toBe(2)
        const plans = new RenewalPlanRepository(scoped)
        const plan = await plans.create({
          name: 'SKU test plan', startingPrice: 100,
          items: [{ productId: product.id, category: '材料', name: 'Item', unit: '件', unitPrice: 100, quantity: 1 }],
        })
        expect((await plans.findOne(plan.id))!.items[0].product!.skus.map(sku => sku.id)).toEqual([replacementBlue.id])
        throw rollback
      }, { timeout: 30000 })
    } catch (error) {
      if (error !== rollback) throw error
    } finally {
      await db.$disconnect()
    }
  }, 40000)
})
