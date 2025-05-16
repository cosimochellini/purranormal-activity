import type { FollowUpQuestion } from '@/app/api/log/refine/route'
import type { Body, Response } from '@/app/api/log/submit/route'
import { fetcher } from '@/utils/fetch'
import { IconX } from '@tabler/icons-react'
import cn from 'classnames'
import { useState } from 'react'
import type { FormValues } from '.'
import { logger } from '../../utils/logger'
import { SpookyButton } from '../common/SpookyButton'
import { SpookyInput } from '../common/SpookyInput'
import { RadioOption } from '../inputs/RadioOption'

interface RefinementSectionProps {
  description?: string
  questions?: FollowUpQuestion[]
  onSubmitSuccess?: (body: Partial<FormValues>) => void
}

interface AnsweredQuestion extends FollowUpQuestion {
  answer: string
}

const submitLog = fetcher<Response, never, Body>('/api/log/submit', 'POST')

export function RefinementSection({
  description,
  questions,
  onSubmitSuccess,
}: RefinementSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [answers, setAnswers] = useState<AnsweredQuestion[]>(
    () => questions?.map((q) => ({ ...q, answer: '' })) ?? [],
  )
  const [secret, setSecret] = useState('')

  const handleSubmit = async () => {
    if (!description) return

    try {
      setIsSubmitting(true)
      const response = await submitLog({ body: { description, answers, secret } })

      if (!response.success) throw new Error('Failed to submit')

      onSubmitSuccess?.({ logId: response.id, missingCategories: response.missingCategories })
    } catch (error) {
      logger.error('Failed to submit log:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAnswerChange = (question: string, answer: string) => {
    setAnswers((prev) => prev.map((p) => (p.question === question ? { ...p, answer } : p)))
  }

  const removeQuestion = (question: string) => {
    setAnswers((prev) => prev.filter((p) => p.question !== question))
  }

  const allAnswersFilled = answers.every((a) => a.answer.length > 0)

  return (
    <div className="max-w-2xl sm:max-w-none mx-auto p-2 h-full">
      <div className="space-y-8 bg-purple-900/30 backdrop-blur-sm rounded-2xl p-8 border border-purple-700/30 relative">
        <div className="space-y-3">
          <h2 className="text-3xl font-magical text-white animate-magical-glow">
            Mystical Inquiries
          </h2>
          <p className="text-purple-200/80">
            The spirits require more details about your supernatural encounter...
          </p>
        </div>

        <div className="space-y-6">
          {answers.map((q) => (
            <div
              key={q.question}
              className="group bg-purple-800/20 rounded-xl p-6 transition-all duration-300 hover:bg-purple-800/30 relative"
            >
              <button
                type="button"
                onClick={() => removeQuestion(q.question)}
                className={cn(
                  'absolute flex items-center justify-center',
                  'top-0 right-0 w-8 h-8 rounded-full',
                  'bg-purple-700/50 text-purple-200 hover:text-red-400 hover:bg-purple-700',
                  'transition-colors duration-300 transform hover:scale-105',
                  'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50',
                )}
              >
                <IconX />
              </button>

              <label className="block text-lg font-medium text-purple-100 mb-4">{q.question}</label>
              <div className="space-y-3">
                {q.availableAnswers.map((a) => (
                  <RadioOption
                    key={a}
                    question={q.question}
                    answer={q.answer}
                    availableAnswer={a}
                    onAnswerChange={handleAnswerChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <SpookyInput
            id="secret"
            label="Secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </div>

        <SpookyButton
          onClick={handleSubmit}
          disabled={isSubmitting || !allAnswersFilled}
          className="w-full mt-6"
          isLoading={isSubmitting}
        >
          {isSubmitting ? 'Channeling spirits...' : 'Submit to the Beyond'}
        </SpookyButton>

        <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
        <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
        <div className="absolute top-1/2 -right-4 h-2 w-2 animate-sparkle delay-700 rounded-full bg-purple-300/80 blur-[1px]" />
      </div>
    </div>
  )
}
