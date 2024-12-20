'use server'
import { categories } from '@/data/enum/category'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { z } from 'zod'

const logFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  category: z.nativeEnum(categories, {
    message: 'Please select a valid category',
  }),
})

export async function createLog(formData: FormData) {
  const data = Object.fromEntries(formData.entries())
  console.log(data)
  const result = await logFormSchema.safeParseAsync(data)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    } as const
  }

  try {
    await db.insert(log).values(result.data)
    return { success: true } as const
  }
  catch {
    return { success: false } as const
  }
}
