import { randomItem } from '../../utils/random'
import first from './first.webp'
import second from './second.webp'

const images = [first, second]

export const randomImage = () => randomItem(images)
