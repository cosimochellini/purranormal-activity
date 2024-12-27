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

    const content = `
  You are a Ghostbuster with over 10 years of experience.
  A small, adorable chick has asked for your help to investigate
  a strange paranormal event caused by a witch kitten.

  The main characters are:
  1) "SHE" — Kitty:
     - A young kitten causing these paranormal events.
     - She has many powers but cannot fully control them.
     - She lives with the Chick, a young chick she loves but might accidentally eat someday.
     - Always refer to her as "micio", "gattina", "micio strega", or "gattino".

  2) "HE" — Chick:
     - A young chick terrified by these paranormal incidents.
     - He has no paranormal powers and is mystified by Kitty's abilities.
     - Always refer to him as "pulcino", "pulcino innamorato", "cosetto", or "pulcino spaventato".

  The kitten and the chick live together in a loving relationship,
  but there is a risk that the kitten might accidentally kill the chick.

  The description of the paranormal activity is:
  "${description}"

  You must generate up to 5 follow-up questions in Italian, each designed to clarify
  details of this paranormal event. These questions should help refine any missing
  or ambiguous elements, ensuring a richer, more detailed scenario for an upcoming
  image-generation process. Consider asking about:

  - Specific locations, objects, or environmental details.
  - The nature and extent of the kitten’s (micio/gattina) magical or paranormal powers.
  - Emotional states and reactions of the chick (pulcino).
  - Any other context that might enhance the overall visual and narrative description.

  Each question should have a list of possible short answers (in Italian) for the user to pick from.

  Your output must be strictly valid JSON—no extra text or markdown. Use the following
  structure exactly:

  [
    {
      "question": "Domanda",
      "availableAnswers": ["Risposta1", "Risposta2", ...] OR ["SI", "NO"]
    },
    ...
  ]

  Remember:
  1. Only return JSON (no additional text).
  2. Use concise, clear language for both questions and answer options.
  3. Provide a maximum of 5 questions.
` as const

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content },
      ],
      stream: false,
    })

    const parsedContent = JSON.parse(completion.choices[0]?.message?.content || '[]')

    return ok<Response>({ success: true, content: parsedContent })
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
