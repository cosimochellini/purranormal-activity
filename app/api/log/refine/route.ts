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

// export const runtime = 'edge'

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
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: `
                        You're a ghostbuster with more than 10 years of experience.
                        A cute, small chick asked for your help with a paranormal activity.
                        The witch cat made for the umpteenth time a paranormal event.
                        this is the description of the paranormal activity:  ${description}.
                        Give me 5 question to understand the better the paranormal activity.
                        The questions should be in the following format:
                        {
                          question: string
                          availableAnswers: string[]
                        }[]
                        Please return the JSON only.
                        `,
          },
        ],
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
      })

      const content = completion.choices[0]?.message?.content || '[]'

      const json = JSON.parse(content) as { questions: FollowUpQuestion[] }

      return ok<Response>({
        success: true,
        content: json.questions,
      })
    }
    catch (error) {
      if (!(error instanceof Error))
        return ok<Response>({ success: false, errors: { description: [JSON.stringify(error)] } })

      return ok<Response>({
        success: false,
        errors: {
          description: ['Failed to generate AI response', error.message],
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
