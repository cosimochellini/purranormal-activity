import { Categories } from '@/data/enum/category'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { openai } from '@/instances/openai'
import { ok } from '@/utils/http'
import { typedObjectValues } from '@/utils/typed'
import { revalidatePath } from 'next/cache'
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
          focusing on two main characters (in Italian):

          1) "SHE" — Kitty:
             - A young kitten, the main cause of paranormal events.
             - She possesses many powers but cannot fully control them.
             - She lives with the Chick, a young chick she loves but might accidentally eat someday.
             - Always refer to her as "micio", "gattina", "micio strega", or "gattino".

          2) "HE" — Chick:
             - A young chick who is constantly terrified by these paranormal incidents.
             - He has no paranormal powers and is mystified by Kitty's abilities.
             - Always refer to him as "pulcino", "pulcino innamorato", "cosetto", or "pulcino spaventato".

          They live together in a loving relationship, though there's a risk
          the kitten might harm the chick by accident.

          Your response must include these elements in **Italian**:

          1. A catchy title (up to 60 characters):
             - Mysterious, paranormal, and cute, in the style of a newspaper headline.

          2. A refined description (up to 250 characters):
             - A brief summary of the paranormal event, emphasizing its extraordinary nature and
               how delighted the kitten is with the results.

          3. A list of fitting categories from the following:
             ${typedObjectValues(Categories).join(', ')}

          **Additional Context**:
          - Original Description: "${description}"
          - Extra Answers:
            ${answers.map(a => `${a.question}: ${a.answer}`).join('\n')}

          Also, provide an "imageDescription" in **English** (up to 250 characters),
          which will be used for generating a visual scene:
          - This field should describe the most crucial visual elements, focusing on the kitten’s powers,
            the chick’s reactions, and any important environmental details.
          - Make sure it is consistent with the Italian text above, but keep it strictly in English.

          **Return ONLY valid JSON** (no markdown, no extra text) with exactly these keys:
          {
            "title": string,        // up to 60 characters, in Italian
            "description": string,  // up to 250 characters, in Italian
            "categories": [${typedObjectValues(Categories).join(', ')}]
          }
        `,
      },
    ],
    // No streaming; we need the full JSON in one piece
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0]?.message?.content || '{}'
  return JSON.parse(content) as {
    title: string
    description: string
    categories: string[]

  }
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

    const {
      title,
      description,
      categories,
    } = await generateLogDetails(result.data)

    // Insert into your logs table (assuming 'log' schema matches these fields).
    // If your schema doesn't include 'imageDescription',
    // you can omit storing it, or store it separately.
    const [newLog] = await db.insert(log).values({
      title,
      description,
      categories: JSON.stringify(categories),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: LogStatus.Created,
    }).returning()

    // Revalidate any necessary paths
    revalidatePath('/', 'page')

    // Return success response, including the brand-new log ID
    // and the "imageDescription" you can use for image generation.
    return ok<Response>({ success: true, id: newLog.id.toString() })
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

// Extend response type to include imageDescription on success
export type Response =
  | {
    success: true
    id: string
  }
  | {
    success: false
    errors: Partial<Record<keyof typeof submitFormSchema.shape, string[]>>
  }

export type Body = z.infer<typeof submitFormSchema>
