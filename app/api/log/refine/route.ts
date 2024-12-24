import { openai } from '@/instances/openai'
import { ok } from '@/utils/http'
import { z } from 'zod'

const schema = z.object({
  description: z.string().min(1, 'Description is required').max(1000, 'Description is too long'),
})

export interface FollowUpQuestion {
  question: string
  availableAnswers: string[]
}

export type Response = {
  success: true
  content: FollowUpQuestion[]
} | {
  success: false
  errors: Partial<Record<keyof typeof schema.shape, string[]>>
}

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await schema.safeParseAsync(data)

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      return ok<Response>({ success: false, errors })
    }

    const { description } = result.data

    try {
      const content = `
        You're a ghostbuster with more than 10 years of experience.
        A cute, small chick asked for your help with a paranormal activity.
        The witch cat made for the umpteenth time a paranormal event.
        this is the description of the paranormal activity:  ${description}.
        Give me 5 questions to understand better the paranormal activity.
        The questions should be in the following format:
        {
          question: string
          availableAnswers: string[]
        }[]
        Please return the JSON only.
        Both the questions and the answers should be in Italian.
      `

      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content }],
        model: 'gpt-3.5-turbo',
        stream: false,
      })

      const parsedContent = JSON.parse(completion.choices[0]?.message?.content || '[]')

      return ok<Response>({ success: true, content: parsedContent })
    }
    catch (error) {
      return ok<Response>({
        success: false,
        errors: {
          description: ['Failed to generate AI response', JSON.stringify(error)],
        },
      })
    }
  }
  catch (error) {
    return ok<Response>({
      success: false,
      errors: {
        description: [JSON.stringify(error)],
      },
    })
  }
}

export type Body = z.infer<typeof schema>
