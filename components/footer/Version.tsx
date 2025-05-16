import { VERSION } from '@/env/package'

export function Version() {
  return (
    <div className="flex flex-row justify-center p-8 sticky">
      <code className="rotate-180">{VERSION}</code>
    </div>
  )
}
