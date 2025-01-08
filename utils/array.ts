export function distinctBy<T>(array: T[], fnKey: (item: T) => string) {
  return [...new Map(array.map(item => [fnKey(item), item])).values()]
}

export function range(length: number) {
  return Array.from({ length }, (_, i) => i)
}
