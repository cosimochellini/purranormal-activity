import { Categories } from '@/data/enum/category'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { openai } from '@/instances/openai'
import { ok } from '@/utils/http'
import { z } from 'zod'

const submitFormSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).min(5, 'At least 5 follow-up answers are required'),
})

async function generateLogDetails({ description, answers }: Body) {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'user',
        content: `
          As an experienced paranormal investigator, analyze this supernatural event and provide:
          1. A catchy title (max 100 chars)
          2. A refined description (max 500 chars)
          3. The most fitting category from: ${Object.values(Categories).join(', ')}

          Original Description: ${description}

          Additional Details:
          ${answers.map(a => `${a.question}: ${a.answer}`).join('\n')}

          Please make sure the title is catchy and the description is refined.
          Please make sure the title and description are written in italian, misterious and paranormal.
          Please return in JSON format:
          {
            "title": string,
            "description": string,
            "category": ${Object.values(Categories).join(', ')}
          }
        `,
      },
    ],
    model: 'gpt-4-turbo-preview',
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0]?.message?.content || '{}'

  return JSON.parse(content) as {
    title: string
    description: string
    category: Categories
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await submitFormSchema.safeParseAsync(data)

    if (!result.success) {
      return ok<Response>({
        success: false,
        errors: result.error.flatten().fieldErrors,
      })
    }

    try {
      const { description, answers } = result.data
      const logDetails = await generateLogDetails({ description, answers })

      const [newLog] = await db.insert(log).values({
        title: logDetails.title,
        description: logDetails.description,
        category: logDetails.category,
      }).returning()

      return ok<Response>({ success: true, id: newLog.id.toString() })
    }
    catch (error) {
      return ok<Response>({
        success: false,
        errors: {
          description: ['Failed to save log entry', JSON.stringify(error)],
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

export type Response = {
  success: true
  id: string
} | {
  success: false
  errors: Partial<Record<keyof typeof submitFormSchema.shape, string[]>>
}

export type Body = z.infer<typeof submitFormSchema>
