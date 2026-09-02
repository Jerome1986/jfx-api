import { resolveServiceCityDivision } from './service-city-code.util'
import { SERVICE_CITY_DIVISIONS } from './service-city.data'

describe('resolveServiceCityDivision', () => {
  it('包含全国地级行政区和四个直辖市', () => {
    expect(SERVICE_CITY_DIVISIONS).toHaveLength(337)
  })

  it.each([
    ['杭州市', { name: '杭州市', code: '330100' }],
    [' 杭州 ', { name: '杭州市', code: '330100' }],
    ['北京', { name: '北京市', code: '110000' }],
    ['阿克苏', { name: '阿克苏地区', code: '652900' }],
  ])('将 %s 解析成标准行政区', (input, expected) => {
    expect(resolveServiceCityDivision(input)).toEqual(expected)
  })

  it('不接受未知城市', () => {
    expect(resolveServiceCityDivision('不存在市')).toBeNull()
  })
})
