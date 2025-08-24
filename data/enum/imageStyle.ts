import { randomItem } from '../../utils/random'
import { typedObjectValues } from '../../utils/typed'

export enum ImageStyle {
  ANIME = 'anime',
  ANIME_CHIBI = 'anime chibi',
  ANIME_KAWAII = 'anime kawaii',
  CARTOON = 'cartoon',
  CARTOON_GHOST_BUSTER = 'cartoon ghostbuster',
  CUBISM = 'cubism',
  EGYPTIAN_MURAL_PAINTING = 'egyptian mural painting',
  ETEGAMI_PAINTING = 'etegami painting',
  GIBHILI = 'gibhili',
  GOUACHE_PAINTING = 'gouache painting',
  INK_WASH_PAINTING = 'ink wash painting',
  LOFI_ART = 'lofi art',
  NAIVE_ART = 'naive art',
  TIM_BURTON = 'tim burton',
  UKYOE_ART = 'ukyo-e art',
  VIDEO_GAME = 'video game retro',
}

export const randomImageStyle = () => randomItem(typedObjectValues(ImageStyle))
