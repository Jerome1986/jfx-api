import { BadRequestException } from '@nestjs/common'

/** Calendar dates use UTC midnight as a storage carrier, not as an appointment instant. */
export function parseInstallationBooking(appointmentDate: string, timeSlot: string, now = new Date()) {
  if (typeof appointmentDate !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(appointmentDate)) {
    throw new BadRequestException('安装日期必须为 YYYY-MM-DD')
  }
  const date = new Date(appointmentDate + 'T00:00:00.000Z')
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== appointmentDate) {
    throw new BadRequestException('安装日期无效')
  }
  if (typeof timeSlot !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeSlot)) {
    throw new BadRequestException('安装时段必须为 HH:mm-HH:mm')
  }
  const [start, end] = timeSlot.split('-')
  if (start >= end) throw new BadRequestException('安装时段结束时间必须晚于开始时间')
  const startsAt = new Date(appointmentDate + 'T' + start + ':00+08:00')
  if (startsAt <= now) throw new BadRequestException('请选择尚未开始的安装时段')
  return { appointmentDate: date, timeSlot }
}
