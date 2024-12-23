'use client'

import type { ComponentType } from 'react'
import type { FollowUpQuestion } from '../../app/api/log/refine/route'
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

interface FormValues {
  description: string
  stream: ReadableStreamDefaultReader<Uint8Array>
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
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([])

  const Component = stateMap[state]

  const handleInitialSuccess = async ({ description, stream }: FormValues) => {
    setState(State.REFINEMENT)
    setBody({ description, stream })

    const decoder = new TextDecoder('utf-8')
    let done = false

    while (!done) {
      const { done: streamDone, value } = await stream.read()
      done = streamDone
      if (!value)
        return

      const chunk = decoder.decode(value, { stream: true })
      const newQuestion = JSON.parse(chunk) as FollowUpQuestion
      setQuestions(prev => [...prev, newQuestion])
    }
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
      questions={questions}
    />
  )
}
