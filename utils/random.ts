export const randomItem = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)]
