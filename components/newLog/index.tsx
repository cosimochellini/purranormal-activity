import type { ComponentType } from 'react'
import { useState } from 'react'
import { usePartialState } from '@/hooks/state'
import type { FollowUpQuestion } from '@/types/api/log-refine'
import { CompletedSection } from './completed'
import { InitialSection } from './initial'
import { RefinementSection } from './refinement'

enum State {
  INITIAL = 'initial',
  REFINEMENT = 'refinement',
  COMPLETED = 'completed',
}

export interface FormValues {
  description: string
  questions: FollowUpQuestion[]
  logId: number
  missingCategories: string[]
}

export interface StateSectionProps {
  onNext?: (body: Partial<FormValues>) => void
  onPrevious?: () => void
  description?: string
  questions?: FollowUpQuestion[]
  logId?: number
  missingCategories?: string[]
}

const stateMap = {
  [State.INITIAL]: InitialSection,
  [State.REFINEMENT]: RefinementSection,
  [State.COMPLETED]: CompletedSection,
} as const satisfies Record<State, ComponentType<StateSectionProps>>

const progress = [State.INITIAL, State.REFINEMENT, State.COMPLETED]

const next = (current: State) => {
  const currentIndex = progress.indexOf(current)
  const next = progress.at(Math.min(currentIndex + 1, progress.length - 1))

  return next ?? State.INITIAL
}

const prev = (current: State) => {
  const currentIndex = progress.indexOf(current)
  const prev = progress.at(Math.max(currentIndex - 1, 0))

  return prev ?? State.COMPLETED
}

export function NewLogForm() {
  const [state, setState] = useState(State.INITIAL)
  const [body, setBody] = usePartialState({} as FormValues)

  const Component = stateMap[state]

  const handleNext = (form: Partial<FormValues>) => {
    setState(next(state))
    setBody(form)
  }

  const handlePrevious = () => {
    setState(prev(state))
  }

  return (
    <Component
      key={state}
      onNext={handleNext}
      onPrevious={handlePrevious}
      description={body?.description}
      questions={body?.questions}
      logId={body?.logId}
      missingCategories={body?.missingCategories}
    />
  )
}
