'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { useState } from 'react'
import type { FollowUpQuestion } from '../../app/api/log/refine/route'

enum State {
  INITIAL = 'initial',
  REFINEMENT = 'refinement',
  COMPLETED = 'completed',
}
const initial = dynamic(() => import('./initial').then(mod => mod.InitialSection), { ssr: false })
const refinement = dynamic(() => import('./refinement').then(mod => mod.RefinementSection), { ssr: false })
const completed = dynamic(() => import('./completed').then(mod => mod.CompletedSection), { ssr: false })

interface FormValues {
  description: string
  questions: FollowUpQuestion[]
}

interface InitialSectionProps {
  onInitialSuccess?: (body: FormValues) => void
  onSubmitSuccess?: (id: string) => void
  description?: string
  questions?: FollowUpQuestion[]
}

const stateMap = {
  [State.INITIAL]: initial,
  [State.REFINEMENT]: refinement,
  [State.COMPLETED]: completed,
} as const satisfies Record<State, ComponentType<InitialSectionProps>>

export function NewLogForm() {
  const [state, setState] = useState(State.INITIAL)
  const [body, setBody] = useState<FormValues>()

  const Component = stateMap[state]

  const handleInitialSuccess = (body: FormValues) => {
    setState(State.REFINEMENT)
    setBody(body)
  }

  const handleRefinementSuccess = () => {
    setState(State.COMPLETED)
  }

  return (
    <Component
      key={state}
      onInitialSuccess={handleInitialSuccess}
      onSubmitSuccess={handleRefinementSuccess}
      description={body?.description}
      questions={body?.questions}
    />
  )
}
