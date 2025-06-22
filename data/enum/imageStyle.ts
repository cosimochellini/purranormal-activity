import { randomItem } from '../../utils/random'
import { typedObjectValues } from '../../utils/typed'

export enum ImageStyle {
  VIDEO_GAME = 'video game retro style',
  CARTOON = 'cartoon style',
  CARTOON_GHOST_BUSTER = 'cartoon ghostbuster style',
  GIBHILI = 'gibhili style',
}

export const randomImageStyle = () => randomItem(typedObjectValues(ImageStyle))
