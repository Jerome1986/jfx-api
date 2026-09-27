/** 获取指定日期所在的北京时间自然月范围，包含 start，不包含 end。默认当前月。 */
export function getBeijingMonthRange(date: Date = new Date()) {
  const offset = 8 * 60 * 60 * 1000
  const beijingDate = new Date(date.getTime() + offset)
  const year = beijingDate.getUTCFullYear()
  const month = beijingDate.getUTCMonth()

  return {
    start: new Date(Date.UTC(year, month, 1) - offset),
    end: new Date(Date.UTC(year, month + 1, 1) - offset),
  }
}
