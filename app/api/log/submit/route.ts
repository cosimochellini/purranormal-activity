import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { NEXT_PUBLIC_APP_URL } from '@/env/next'
import { generateLogDetails } from '@/services/ai'
import { ok } from '@/utils/http'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const submitFormSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).max(5, 'At least 5 follow-up answers are required'),
})

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
      imageDescription,
    } = await generateLogDetails(result.data.description, result.data.answers)

    // Insert into your logs table (assuming 'log' schema matches these fields).
    // If your schema doesn't include 'imageDescription',
    // you can omit storing it, or store it separately.
    const [newLog] = await db.insert(log).values({
      title,
      description,
      imageDescription,
      categories: JSON.stringify(categories),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: LogStatus.Created,
    }).returning()

    // Revalidate any necessary paths
    revalidatePath('/', 'page')

    fetch(`${NEXT_PUBLIC_APP_URL}/api/trigger/images`, {
      method: 'POST',
    })

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
