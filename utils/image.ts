export async function downloadImageAsBuffer(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${url}`)
  }
  const arrayBuffer = await res.arrayBuffer()

  return Buffer.from(arrayBuffer)
}

export type AssetLike = string | { src: string }

export function toAssetSrc(asset: AssetLike) {
  return typeof asset === 'string' ? asset : asset.src
}
