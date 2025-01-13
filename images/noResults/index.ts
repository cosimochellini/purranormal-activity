import { randomItem } from '../../utils/random'
import first from './1.webp'
import second from './2.webp'

const images = [first, second]

export function randomImage() {
  return randomItem(images)
}
