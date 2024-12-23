import { SpookyBackground } from '@/components/background/SpookyBackground'
import { NewLogForm } from '@/components/newLog'

export default function NewLogPage() {
  return (
    <div className="relative min-h-screen bg-deep-purple-900 p-4 text-white">
      <SpookyBackground />

      <main className="relative mx-auto flex flex-col items-center justify-center">
        <h1 className="mb-8 text-center text-balance text-4xl font-magical animate-magical-glow">
          Record New Purranormal Activity
        </h1>

        <NewLogForm />
      </main>
    </div>
  )
}
