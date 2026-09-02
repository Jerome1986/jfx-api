import { SERVICE_CITY_DIVISIONS } from './service-city.data'

export interface ServiceCityDivision {
  name: string
  code: string
}

// 清理城市名称首尾及内部空白字符。
const normalize = (name: string) => name.trim().replace(/\s+/g, '')

// 生成官方名称及去除常见行政区后缀的别名。
const aliasesFor = (name: string) => {
  const aliases = new Set([name])
  if (name.endsWith('市') || name.endsWith('盟')) aliases.add(name.slice(0, -1))
  if (name.endsWith('地区')) aliases.add(name.slice(0, -2))
  return aliases
}

const divisionByAlias = new Map<string, ServiceCityDivision[]>()

for (const division of SERVICE_CITY_DIVISIONS) {
  for (const alias of aliasesFor(division.name)) {
    const matches = divisionByAlias.get(alias) ?? []
    matches.push(division)
    divisionByAlias.set(alias, matches)
  }
}

// 按官方名称或无“市/地区/盟”后缀的常用简称解析行政区。
export function resolveServiceCityDivision(input: string): ServiceCityDivision | null {
  const matches = divisionByAlias.get(normalize(input)) ?? []
  return matches.length === 1 ? matches[0] : null
}
