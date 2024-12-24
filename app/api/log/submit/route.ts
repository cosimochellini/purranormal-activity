import { Categories } from '@/data/enum/category'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { openai } from '@/instances/openai'
import { ok } from '@/utils/http'
import { typedObjectValues } from '@/utils/typed'
import { z } from 'zod'

const submitFormSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).max(5, 'At least 5 follow-up answers are required'),
})

async function generateLogDetails({ description, answers }: Pick<Body, 'description' | 'answers'>) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: `
          You are an experienced Ghostbuster with more than 10 years of service.
          Your task is to craft an official log entry describing a magical and inexplicable event,
          focusing on two main characters:

          1) "SHE" — Kitty:
             - A young kitten, the primary reason for paranormal events.
             - She possesses many powers but is unable to fully control them.
             - She lives with the Chick, a young chick she loves but might accidentally eat someday.
             - Make sure she is always named "micio", "gattina", "micio strega" , or "gattino"

          2) "HE" — Chick:
             - A young chick who is constantly terrified by these paranormal incidents.
             - He has no paranormal powers and is mystified by Kitty's abilities.
             - Make sure he is always name "pulcino", "pulcino innamorato", "cosetto" , or "pulcino spaventato"

          Your response must include the following elements, in Italian:

          1. A catchy title (max 100 characters):
             - Must be mysterious, paranormal, cute, and in the style of a newspaper headline.

          2. A refined description (max 500 characters):
             - A brief summary of the paranormal event, emphasizing its extraordinary nature and
               highlighting how pleased the kitty is with the resulting occurrence.

          3. A list of fitting categories from the following:
             ${typedObjectValues(Categories).join(', ')}

          Additional Context:
          - Original Description: "${description}"
          - Extra Answers:
            ${answers.map(a => `${a.question}: ${a.answer}`).join('\n')}

          Please return ONLY valid JSON (no markdown, no extra text) with the exact keys:
          {
            "title": string,       // up to 60 characters
            "description": string, // up to 250 characters
            "categories": [${typedObjectValues(Categories).join(', ')}]
          }

          Make sure the JSON is properly formatted and strictly follows the structure above.
          Make sure that is clear that they are in love and that the kitten might accidentally kill the chick.

          `,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0]?.message?.content || '{}'
  return JSON.parse(content) as typeof log['$inferSelect']
}

export const runtime = 'edge'

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
        categories: JSON.stringify(logDetails.categories),
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
