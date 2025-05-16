import classNames from 'classnames'

interface AnimatedWordProps {
  text: string
  color?: string
  className?: string
}

const baseStyles =
  'inline-block transition-all duration-500 cursor-default opacity-70 blur-[0.5px] pl-2'
const hoverStyles = 'hover:scale-110 hover:opacity-90 hover:blur-0 hover:text-white/90'
const animationStyles = 'animate-magical-glow animate-ghost'

export function AnimatedWord({ text, color = 'text-magical-glow', className }: AnimatedWordProps) {
  return (
    <span className={classNames(baseStyles, hoverStyles, animationStyles, color, className)}>
      {text}
    </span>
  )
}
