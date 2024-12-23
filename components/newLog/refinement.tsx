import type { FollowUpQuestion } from '@/app/api/log/refine/route'
import type { Body, Response } from '@/app/api/log/submit/route'
import type { FormValues } from '.'
import { fetcher } from '@/utils/fetch'
import cn from 'classnames'
import { useState } from 'react'
import { SpookyButton } from '../common/SpookyButton'

interface RefinementSectionProps {
  description?: string
  questions?: FollowUpQuestion[]
  onSubmitSuccess?: (body: Partial<FormValues>) => void
}

interface AnsweredQuestion extends FollowUpQuestion {
  answer: string
}

const submitLog = fetcher<Response, never, Body>('/api/log/submit', 'POST')

interface RadioOptionProps {
  question: string
  answer: string
  availableAnswer: string
  onAnswerChange: (question: string, answer: string) => void
}

function RadioOption({ question, answer, availableAnswer, onAnswerChange }: RadioOptionProps) {
  return (
    <div
      className="flex items-center space-x-3 group/radio cursor-pointer"
      onClick={() => onAnswerChange(question, availableAnswer)}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="radio"
          value={availableAnswer}
          checked={answer === availableAnswer}
          onChange={() => onAnswerChange(question, availableAnswer)}
          className="peer absolute opacity-0 w-full h-full cursor-pointer"
        />
        <div className={cn(
          'w-5 h-5 border-2 rounded-full transition-all duration-300',
          'border-purple-500/50 bg-purple-900/30',
          'group-hover/radio:border-purple-400/70',
          answer === availableAnswer
            ? [
                'border-purple-400 bg-purple-500/20',
                'shadow-[0_0_8px_rgba(168,85,247,0.3)]',
                'after:opacity-100 after:scale-100',
              ]
            : ['after:opacity-0 after:scale-0'],
          'after:content-[\'\'] after:absolute',
          'after:w-2 after:h-2 after:rounded-full',
          'after:bg-purple-400',
          'after:transition-all after:duration-300',
        )}
        />
      </div>
      <label
        className={cn(
          'text-purple-200/70 transition-all duration-300 cursor-pointer select-none',
          'group-hover/radio:text-purple-100',
          answer === availableAnswer && [
            'text-purple-100 font-medium',
            'text-shadow-[0_0_10px_rgba(168,85,247,0.3)]',
          ],
        )}
      >
        {availableAnswer}
      </label>
    </div>
  )
}

export function RefinementSection({ description, questions, onSubmitSuccess }: RefinementSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [answers, setAnswers] = useState<AnsweredQuestion[]>(() => questions?.map(q => ({ ...q, answer: '' })) ?? [])

  const handleSubmit = async () => {
    if (!description)
      return

    try {
      setIsSubmitting(true)
      const response = await submitLog({ body: { description, answers } })

      if (!response.success)
        throw new Error('Failed to submit')

      onSubmitSuccess?.({ logId: response.id })
    }
    catch (error) {
      console.error('Failed to submit log:', error)
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const handleAnswerChange = (question: string, answer: string) => {
    setAnswers(prev => prev.map(p => p.question === question ? { ...p, answer } : p))
  }

  const allAnswersFilled = answers.every(a => a.answer.length > 0)

  return (
    <div className="max-w-2xl sm:max-w-none mx-auto p-2 h-full">
      <div className="space-y-8 bg-purple-900/30 backdrop-blur-sm rounded-2xl p-8 :p-2 border border-purple-700/30 relative">
        <div className="space-y-3">
          <h2 className="text-3xl font-magical text-white animate-magical-glow">
            Mystical Inquiries
          </h2>
          <p className="text-purple-200/80">
            The spirits require more details about your supernatural encounter...
          </p>
        </div>

        <div className="space-y-6">
          {answers.map(q => (
            <div
              key={q.question}
              className="group bg-purple-800/20 rounded-xl p-6 transition-all duration-300 hover:bg-purple-800/30"
            >
              <label className="block text-lg font-medium text-purple-100 mb-4">
                {q.question}
              </label>
              <div className="space-y-3">
                {q.availableAnswers.map(a => (
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
