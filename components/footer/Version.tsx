import { serverEnv } from '@/env/server'

export function Version() {
  return (
    <div className="flex flex-row justify-center p-8 sticky">
      <code className="rotate-180">{serverEnv.version}</code>
    </div>
  )
}
