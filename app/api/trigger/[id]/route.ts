import type OpenAI from 'openai'
import { LogStatus } from '@/data/enum/logStatus'
import { log } from '@/db/schema'
import { db } from '@/drizzle'
import { openai } from '@/instances/openai'
import { ok } from '@/utils/http'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { BUCKET_NAME } from '../../../../env/cloudflare'
import { S3 } from '../../../../instances/s3'

export const runtime = 'edge'

const styles = [
  'bitmap style',
  '8bit style',
] as const

const randomStyle = () => styles[Math.floor(Math.random() * styles.length)]

async function downloadImageAsBuffer(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${url}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  // eslint-disable-next-line node/prefer-global/buffer
  return Buffer.from(arrayBuffer)
}

async function generateImagePrompt(openai: OpenAI, description: string) {
  try {
    const content = `
        You are a world-class prompt engineer.
        Read the following user description carefully and transform it into a single, concise image-prompt description:

        ---
        User Description:
        "${description}"
        ---

        **Your Task**:
        1. Identify the location from the user description. If it is not clearly specified, assume they're at home.
        2. Determine what the kitten is doing, especially any magical or supernatural actions.
        3. Include a small, cute chick in the background, reacting with fear or awe to the kitten’s powers.
        4. Convert any references to real-world, copyrighted, or trademarked items into generic equivalents. Avoid mentioning brand or product names.
        5. Do not include any text or lettering in the image.
        6. Maintain an overall "cute" or "adorable" style.
        7. Focus on describing the visual scene in detail, ensuring it is easy to visualize.
        8. Use the style: ${randomStyle()}
        9. Keep the final output to a single paragraph, under about 150 words if possible.
        10. The final prompt **must** start with: "Create an image with a magical kitten..."
            and end with: "... - STYLE_HERE"

        **Example structure** (for reference only; do not copy verbatim):
        "Create an image with a magical kitten in the middle, the kitten is [ACTION].
         There is a small cute chick in the background.
         The location is [LOCATION].
         - [STYLE_HERE]"

        **Important**:
        - Replace [ACTION] with the main magical or supernatural activity the kitten is doing.
        - Replace [LOCATION] with the identified or default location.
        - Replace [STYLE_HERE] with the final style you decide on from the provided styles.

        Now, generate the final prompt as a single string.
        PLEASE, return just the string, max 250 chars.
      ` as const

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content }],
      // Optionally, you could add temperature, max_tokens, etc.:
      // temperature: 0.7,
      // max_tokens: 200,
    })

    const ret = completion.choices[0]?.message?.content

    console.log('Generated Image Prompt:', ret)

    if (!ret)
      throw new Error('Failed to generate image prompt')

    return ret
  }
  catch (error) {
    console.error('Error generating image prompt:', error)
    throw new Error('Image prompt generation failed')
  }
}

async function generateImage(openai: OpenAI, imagePrompt: string) {
  try {
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    })

    const imageData = imageResponse.data[0]?.url

    if (!imageData)
      throw new Error('Failed to generate image data')

    const buffer = await downloadImageAsBuffer(imageData)

    return buffer
  }
  catch (error) {
    console.error('Error generating image:', error)
    throw new Error('Image generation failed')
  }
}

// eslint-disable-next-line node/prefer-global/buffer
async function uploadToS3(buffer: Buffer, logId: number) {
  try {
    await S3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${logId}/cover.webp`,
      Body: buffer,
      ContentType: 'image/webp',
    }))
  }
  catch (error) {
    console.error('Error uploading to S3:', error)
    throw new Error('S3 upload failed')
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const logId = Number(url.searchParams.get('id'))

    // Get log details
    const [logEntry] = await db
      .select()
      .from(log)
      .where(eq(log.id, logId))

    if (!logEntry)
      return ok({ success: false, error: 'Log not found' })

    const imagePrompt = await generateImagePrompt(openai, logEntry.description)

    const buffer = await generateImage(openai, imagePrompt)

    await uploadToS3(buffer, logId)

    // Update log status
    await db
      .update(log)
      .set({ status: LogStatus.ImageGenerated })
      .where(eq(log.id, logId))

    return ok({ success: true })
  }
  catch (error) {
    console.error('Failed to generate image:', error)

    return ok({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
