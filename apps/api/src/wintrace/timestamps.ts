import dayjs from 'dayjs'
import utcPlugin from 'dayjs/plugin/utc'

dayjs.extend(utcPlugin)

const logfileTimestampRegExp = /(\d{4})(\d{2})(\d{8}).*/

export const parseLogfileTimestamp = (value: string) => {
  const match = value.match(logfileTimestampRegExp)

  if (!match) {
    return null
  }

  const [, year, month, rest] = match

  return dayjs(
    `${year}${String(Number(month) + 1).padStart(2, '0')}${rest}`,
    'YYYYMMDDHHmmss',
  ).utc(true)
}

export const toIsoTimestampFromLogfile = (value: string) => {
  const parsed = parseLogfileTimestamp(value)

  return parsed?.isValid() ? parsed.toISOString() : value
}

export const toMorgueTimestampFromLogfile = (value: string) => {
  const parsed = parseLogfileTimestamp(value)

  return parsed?.isValid() ? parsed.format('YYYYMMDD-HHmmss') : value
}
