/* eslint-disable node/prefer-global/buffer */

export async function downloadImageAsBuffer(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${url}`)
  }
  const arrayBuffer = await res.arrayBuffer()

  return Buffer.from(arrayBuffer)
}
