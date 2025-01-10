'use client'

import type { FollowUpQuestion } from '@/app/api/log/refine/route'
import type { ComponentType } from 'react'
import { usePartialState } from '@/hooks/state'
import dynamic from 'next/dynamic'
import { useState } from 'react'

enum State {
  INITIAL = 'initial',
  REFINEMENT = 'refinement',
  COMPLETED = 'completed',
}
const initial = dynamic(() => import('./initial').then(mod => mod.InitialSection), { ssr: false })
const refinement = dynamic(() => import('./refinement').then(mod => mod.RefinementSection), { ssr: false })
const completed = dynamic(() => import('./completed').then(mod => mod.CompletedSection), { ssr: false })

export interface FormValues {
  description: string
  questions: FollowUpQuestion[]
  logId: number
  missingCategories: string[]
}

interface InitialSectionProps {
  onInitialSuccess?: (body: Partial<FormValues>) => void
  onSubmitSuccess?: (body: Partial<FormValues>) => void
  description?: string
  questions?: FollowUpQuestion[]
  logId?: number
  missingCategories?: string[]
}

const stateMap = {
  [State.INITIAL]: initial,
  [State.REFINEMENT]: refinement,
  [State.COMPLETED]: completed,
} as const satisfies Record<State, ComponentType<InitialSectionProps>>

export function NewLogForm() {
  const [state, setState] = useState(State.INITIAL)
  const [body, setBody] = usePartialState({} as FormValues)

  const Component = stateMap[state]

  const handleInitialSuccess = ({ description, questions }: Partial<FormValues>) => {
    setState(State.REFINEMENT)
    setBody({ description, questions })
  }

  const handleRefinementSuccess = ({ logId, missingCategories }: Partial<FormValues>) => {
    setState(State.COMPLETED)
    setBody({ logId, missingCategories })
  }

  return (
    <Component
      key={state}
      onInitialSuccess={handleInitialSuccess}
      onSubmitSuccess={handleRefinementSuccess}
      description={body?.description}
      questions={body?.questions}
      logId={body?.logId}
      missingCategories={body?.missingCategories}
    />
  )
}
