import { S3Client } from '@aws-sdk/client-s3'
import { ACCESS_KEY_ID, BUCKET_URL, SECRET_ACCESS_KEY } from '@/env/cloudflare'

let client: S3Client | undefined

const getClient = () => {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: BUCKET_URL,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    })
  }
  return client
}

export const S3 = {
  send: ((...args: Parameters<S3Client['send']>) => getClient().send(...args)) as S3Client['send'],
}
