import { createQuestions } from '@/services/ai'
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

    const content = await createQuestions(description)

    return ok<Response>({ success: true, content })
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
