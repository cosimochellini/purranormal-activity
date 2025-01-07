import { ACCESS_KEY_ID, BUCKET_URL, SECRET_ACCESS_KEY } from '@/env/cloudflare'
import { S3Client } from '@aws-sdk/client-s3'

export const S3 = new S3Client({
  region: 'auto',
  endpoint: BUCKET_URL,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
})
