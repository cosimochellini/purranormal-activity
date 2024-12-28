import { randomItem } from '@/utils/random'
import first from './1.webp'
import second from './2.webp'
import third from './3.webp'
import fourth from './4.webp'
import fifth from './5.webp'
import sixth from './6.webp'
import seventh from './7.webp'
import eighth from './8.webp'
import ninth from './9.webp'
import tenth from './10.webp'

export const images = [
  first,
  second,
  third,
  fourth,
  fifth,
  sixth,
  seventh,
  eighth,
  ninth,
  tenth,
] as const

export function randomImage() {
  return randomItem(images)
}
