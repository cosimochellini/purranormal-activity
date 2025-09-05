import { IconX } from '@tabler/icons-react'
import cn from 'classnames'
import { useState } from 'react'
import type { FollowUpQuestion } from '@/app/api/log/refine/route'
import type { Body, Response } from '@/app/api/log/submit/route'
import { fetcher } from '@/utils/fetch'
import { logger } from '../../utils/logger'
import { SpookyButton } from '../common/SpookyButton'
import { SpookyInput } from '../common/SpookyInput'
import { RadioOption } from '../inputs/RadioOption'
import type { StateSectionProps } from '.'

interface AnsweredQuestion extends FollowUpQuestion {
  answer: string
  otherText: string | null
}

const submitLog = fetcher<Response, never, Body>('/api/log/submit', 'POST')

// Helper functions
const MAX_OTHER_TEXT_LENGTH = 150
const OTHER_OPTION = 'Other'

const validateOtherText = (text: string) => text.length <= MAX_OTHER_TEXT_LENGTH

const isOtherOption = (answer: string) => answer === OTHER_OPTION

// Reusable components
interface OtherTextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

function OtherTextInput({
  value,
  onChange,
  placeholder = 'Specify other details...',
  className = '',
}: OtherTextInputProps) {
  const remainingChars = MAX_OTHER_TEXT_LENGTH - value.length
  const isValid = validateOtherText(value)

  return (
    <div className={cn('space-y-2', className)}>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={MAX_OTHER_TEXT_LENGTH}
        className={cn(
          'w-full px-3 py-2 rounded-lg bg-purple-900/30 border transition-all duration-300',
          'text-purple-100 placeholder-purple-400/60',
          'focus:outline-none focus:ring-2 focus:ring-purple-400/50',
          isValid ? 'border-purple-600/50' : 'border-red-500/50',
          'hover:border-purple-500/70',
          'resize-vertical min-h-[80px]',
        )}
      />
      <div className="flex justify-between text-xs">
        <span
          className={cn(
            'transition-colors duration-300',
            isValid ? 'text-purple-300/70' : 'text-red-400',
          )}
        >
          {isValid ? '' : 'Text too long'}
        </span>
        <span
          className={cn(
            'transition-colors duration-300',
            remainingChars < 20 ? 'text-orange-400' : 'text-purple-300/70',
          )}
        >
          {remainingChars} characters left
        </span>
      </div>
    </div>
  )
}

export function RefinementSection({
  description,
  questions,
  onNext,
  onPrevious,
}: StateSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [answers, setAnswers] = useState<AnsweredQuestion[]>(
    () => questions?.map((q) => ({ ...q, answer: '', otherText: null })) ?? [],
  )
  const [secret, setSecret] = useState('')

  const handleSubmit = async () => {
    if (!description) return

    try {
      setIsSubmitting(true)

      const payloadAnswers = answers.map((a) => {
        if (isOtherOption(a.answer)) return { question: a.question, answer: a.otherText ?? '' }

        return { question: a.question, answer: a.answer }
      })

      const response = await submitLog({ body: { description, answers: payloadAnswers, secret } })

      if (!response.success) throw new Error('Failed to submit')

      onNext?.({ logId: response.id, missingCategories: response.missingCategories })
    } catch (error) {
      logger.error('Failed to submit log:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAnswerChange = (question: string, answer: string) => {
    setAnswers((prev) =>
      prev.map((p) =>
        p.question === question
          ? { ...p, answer, otherText: isOtherOption(answer) ? p.otherText || '' : null }
          : p,
      ),
    )
  }

  const handleOtherTextChange = (question: string, otherText: string) => {
    setAnswers((prev) => prev.map((p) => (p.question === question ? { ...p, otherText } : p)))
  }

  const removeQuestion = (question: string) => {
    setAnswers((prev) => prev.filter((p) => p.question !== question))
  }

  const allAnswersFilled = answers.every((a) => {
    const hasAnswer = a.answer.length > 0
    const needsOtherText = isOtherOption(a.answer)
    const hasValidOtherText = needsOtherText
      ? a.otherText?.length && validateOtherText(a.otherText)
      : true
    return hasAnswer && hasValidOtherText
  })

  return (
    <div className="max-w-2xl sm:max-w-none mx-auto md:p-2 h-full">
      <div className="space-y-8 bg-purple-900/30 backdrop-blur-xs rounded-2xl p-6 border border-purple-700/30 relative">
        <div className="space-y-3">
          <h2 className="text-3xl font-magical text-white animate-magical-glow">
            In-depth questions
          </h2>
          <p className="text-purple-200/80">
            To help us understand the event better, we need to ask you some questions.
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
                  '-top-3 -right-3 w-8 h-8 rounded-full',
                  'bg-red-700/50 text-purple-200 hover:text-red-400 hover:bg-purple-700',
                  'transition-colors duration-300 transform hover:scale-105',
                  'focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-opacity-50',
                )}
              >
                <IconX />
              </button>

              {/* biome-ignore lint/a11y/noLabelWithoutControl: it's a label */}
              <label className="block text-lg font-medium text-purple-100 mb-4">{q.question}</label>
              <div className="space-y-4">
                {q.availableAnswers.map((a) => (
                  <RadioOption
                    key={a}
                    question={q.question}
                    answer={q.answer}
                    availableAnswer={a}
                    onAnswerChange={handleAnswerChange}
                  />
                ))}
                <div className="space-y-4">
                  <RadioOption
                    key={OTHER_OPTION}
                    question={q.question}
                    answer={q.answer}
                    availableAnswer={OTHER_OPTION}
                    onAnswerChange={handleAnswerChange}
                  />
                  {isOtherOption(q.answer) && (
                    <div className="ml-8">
                      <OtherTextInput
                        value={q.otherText ?? ''}
                        onChange={(value) => handleOtherTextChange(q.question, value)}
                        placeholder="Specify other details..."
                      />
                    </div>
                  )}
                </div>
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

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <SpookyButton onClick={onPrevious} disabled={isSubmitting} variant="secondary">
            Back
          </SpookyButton>

          <SpookyButton
            onClick={handleSubmit}
            disabled={isSubmitting || !allAnswersFilled}
            className="flex-1"
            isLoading={isSubmitting}
          >
            Save event
          </SpookyButton>
        </div>

        <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-purple-300/80 blur-[1px]" />
        <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-purple-300/80 blur-[1px]" />
        <div className="absolute top-1/2 -right-4 h-2 w-2 animate-sparkle delay-700 rounded-full bg-purple-300/80 blur-[1px]" />
      </div>
    </div>
  )
}
