interface TimeProps {
  seconds?: number
  minutes?: number
  hours?: number
  days?: number
  months?: number
}
const second = 1 * 1000
const minute = second * 60
const hour = minute * 60
const day = hour * 24
const month = day * 30

export function time({ seconds, minutes, hours, days, months }: TimeProps) {
  return (seconds ?? 0) * second
    + (minutes ?? 0) * minute
    + (hours ?? 0) * hour
    + (days ?? 0) * day
    + (months ?? 0) * month
}
