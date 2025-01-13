import type { IconProps } from '@tabler/icons-react'
import {
  IconAlien,
  IconCheck,
  IconClock,
  IconGhost,
  IconMoon,
  IconPizza,
  IconPlayCardStarFilled,
  IconQuestionMark,
  IconRobot,
  IconZzz,
} from '@tabler/icons-react'

export const categoryIcons = {
  alien: IconAlien,
  clock: IconClock,
  check: IconCheck,
  moon: IconMoon,
  ghost: IconGhost,
  food: IconPizza,
  robot: IconRobot,
  zzz: IconZzz,
  questionMark: IconQuestionMark,
  fortune: IconPlayCardStarFilled,
} as const satisfies Record<string, React.ComponentType<IconProps>>
