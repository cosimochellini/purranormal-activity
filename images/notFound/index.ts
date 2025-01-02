import { randomItem } from '../../utils/random'
import first from './first.webp'
import fourth from './fourth.webp'
import second from './second.webp'
import third from './third.webp'

const images = [first, second, third, fourth]

export const randomImage = () => randomItem(images)
