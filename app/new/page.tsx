import { SpookyBackground } from '../components/background/SpookyBackground'
import { NewLogForm } from './NewLogForm'

export default function NewLogPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-deep-purple-900 p-8 pb-20 text-white sm:p-20">
      <SpookyBackground />

      <main className="relative mx-auto max-w-2xl">
        <h1 className="mb-8 text-center text-4xl font-magical animate-magical-glow">
          Record New Paranormal Activity
        </h1>

        <NewLogForm />
      </main>
    </div>
  )
}
