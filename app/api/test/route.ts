import { S3 } from '@/instances/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { BUCKET_NAME } from '../../../env/cloudflare'

export const runtime = 'edge'

export async function GET(_: Request) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: '10/cover.webp',
    })

    const response = await S3.send(command)
    const imageStream = response.Body

    if (!imageStream) {
      throw new Error('No image data received')
    }

    return new Response(imageStream as ReadableStream, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Content-Length': response.ContentLength?.toString() || '',
      },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching image:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
