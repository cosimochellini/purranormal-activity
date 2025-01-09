import { randomItem } from '../../utils/random'
import { typedObjectValues } from '../../utils/typed'

export enum ImageStyle {
  BITMAP = 'bitmap style',
  EIGHT_BIT = '8bit style',
  VIDEO_GAME = 'video game retro style',
  CARTOON = 'cartoon style',
}

export const randomImageStyle = () => randomItem(typedObjectValues(ImageStyle))
