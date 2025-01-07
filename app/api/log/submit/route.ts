import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { generateLogDetails } from '@/services/ai'
import { ok } from '@/utils/http'
import { logger } from '@/utils/logger'
import { regenerateContents } from '@/utils/next'
import { z } from 'zod'
import { SECRET } from '../../../../env/secret'

const submitFormSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).max(5, 'At least 5 follow-up answers are required'),
  secret: z
    .string()
    .refine(val => val === SECRET, { message: 'Invalid secret' }),
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

    const [newLog] = await db.insert(log).values({
      title,
      description,
      imageDescription,
      categories: JSON.stringify(categories),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: LogStatus.Created,
    }).returning()

    regenerateContents()

    return ok<Response>({ success: true, id: newLog.id.toString() })
  }
  catch (error) {
    logger.error('Failed to submit log:', error)

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
