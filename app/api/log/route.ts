import { Categories } from '@/data/enum/category'
import { log } from '@/db/schema'
import { db } from '@/drizzle'

import { ok } from '@/utils/http'
import { z } from 'zod'
import { LogStatus } from '../../../data/enum/logStatus'

const logFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  categories: z.array(z.nativeEnum(Categories, {
    message: 'Please select a valid category',
  })),
})

export type Response = {
  success: true
} | {
  success: false
  errors: Partial<Record<keyof typeof logFormSchema.shape, string[]>>
}
export const runtime = 'edge'
export async function POST(request: Request) {
  const data = await request.json()

  const result = await logFormSchema.safeParseAsync(data)

  if (!result.success) {
    return ok<Response>({
      success: false,
      errors: result.error.flatten().fieldErrors,
    })
  }

  try {
    await db.insert(log).values({
      ...result.data,
      categories: JSON.stringify(result.data.categories),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: LogStatus.Created,
    })

    return ok<Response>({ success: true })
  }
  catch {
    return ok<Response>({ success: false, errors: {} })
  }
}

export type Body = z.infer<typeof logFormSchema>
