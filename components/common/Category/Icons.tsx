import type { IconProps } from '@tabler/icons-react'
import {
  IconAlien,
  IconCheck,
  IconChessKnightFilled,
  IconClock,
  IconGhost,
  IconMoon,
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
  food: IconChessKnightFilled,
  robot: IconRobot,
  zzz: IconZzz,
  questionMark: IconQuestionMark,
} as const satisfies Record<string, React.ComponentType<IconProps>>
