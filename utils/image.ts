/* eslint-disable node/prefer-global/buffer */
import sharp from 'sharp'

export async function generateBlurDataURL(buffer: Buffer) {
  const blurredBuffer = await sharp(buffer)
    .resize(8, 8, { fit: 'inside' })
    .blur(4)
    .toBuffer()

  return `data:image/webp;base64,${blurredBuffer.toString('base64')}` as const
}

export async function downloadImageAsBuffer(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${url}`)
  }
  const arrayBuffer = await res.arrayBuffer()

  return Buffer.from(arrayBuffer)
}
