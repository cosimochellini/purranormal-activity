import type { ReactNode } from 'react'
import cn from 'classnames'

interface RadioOptionProps {
  question: string
  answer: string
  availableAnswer: string
  onAnswerChange: (question: string, answer: string) => void
}

interface RadioInputProps {
  availableAnswer: string
  answer: string
  onChange: () => void
}

const activeClasses = cn(
  'border-purple-400 bg-purple-500/20',
  'shadow-[0_0_8px_rgba(168,85,247,0.3)]',
  'after:opacity-100 after:scale-100',
)

const defaultClasses = cn(
  'after:opacity-0 after:scale-0',
)

function RadioInput({ availableAnswer, answer, onChange }: RadioInputProps) {
  const active = answer === availableAnswer

  return (
    <div className="relative flex items-center justify-center">
      <input
        type="radio"
        value={availableAnswer}
        checked={active}
        onChange={onChange}
        className="peer absolute opacity-0 w-full h-full cursor-pointer"
      />
      <div
        className={cn(
          'w-5 h-5 border-2 rounded-full transition-all duration-300',
          'border-purple-500/50 bg-purple-900/30',
          'group-hover/radio:border-purple-400/70',
          'relative after:content-[""] after:absolute',
          'after:w-2 after:h-2 after:rounded-full',
          'after:bg-purple-400',
          'after:transition-all after:duration-300',
          active && activeClasses,
          !active && defaultClasses,
        )}
      />
    </div>
  )
}

interface RadioLabelProps {
  availableAnswer: string
  answer: string
  children: ReactNode
}

function RadioLabel({ availableAnswer, answer, children }: RadioLabelProps) {
  return (
    <label
      className={cn(
        'text-purple-200/70 transition-all duration-300 cursor-pointer select-none',
        'group-hover/radio:text-purple-100',
        answer === availableAnswer && 'text-purple-100',
      )}
    >
      {children}
    </label>
  )
}

export function RadioOption(
  { question, answer, availableAnswer, onAnswerChange }: RadioOptionProps,
) {
  const handleChange = () => onAnswerChange(question, availableAnswer)

  return (
    <div className="flex items-center space-x-3 group/radio cursor-pointer" onClick={handleChange}>
      <RadioInput availableAnswer={availableAnswer} answer={answer} onChange={handleChange} />
      <RadioLabel availableAnswer={availableAnswer} answer={answer}>
        {availableAnswer}
      </RadioLabel>
    </div>
  )
}
