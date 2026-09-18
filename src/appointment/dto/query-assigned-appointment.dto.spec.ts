import { ValidationPipe } from '@nestjs/common'
import { QueryAssignedAppointmentDto } from './query-assigned-appointment.dto'

describe('QueryAssignedAppointmentDto', () => {
  const pipe = new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true,
  })
  const parse = (query: object) => pipe.transform({ userId: '1', ...query }, {
    type: 'query', metatype: QueryAssignedAppointmentDto,
  })

  it('提供默认分页并转换查询参数', async () => {
    await expect(parse({})).resolves.toMatchObject({ userId: 1, pageNum: 1, pageSize: 10 })
    await expect(parse({ pageNum: '2', pageSize: '5', type: 'PLAN' }))
      .resolves.toMatchObject({ pageNum: 2, pageSize: 5, type: 'PLAN' })
    await expect(parse({ type: 'ALL' })).resolves.toMatchObject({ type: 'ALL' })
    await expect(parse({ status: 'ALL' })).resolves.toMatchObject({ status: 'ALL' })
    await expect(parse({ status: 'PENDING_VISIT' })).resolves.toMatchObject({ status: 'PENDING_VISIT' })
  })

  it.each([
    { pageNum: '0' }, { pageNum: '-1' }, { pageSize: '1.5' },
    { pageSize: 'abc' }, { type: 'INVALID' }, { employeeId: '99' },
    { userId: undefined }, { userId: '0' }, { userId: 'abc' },
    { status: 'INVALID' }, { status: 'IN_SERVICE' },
  ])('拒绝非法参数 %j', async (query) => {
    await expect(parse(query)).rejects.toThrow()
  })
})
