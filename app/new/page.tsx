import { SpookyBackground } from '../components/background/SpookyBackground'
import { NewLogForm } from './NewLogForm'

export default function NewLogPage() {
  return (
    <div className="relative h-screen overflow-hidden bg-deep-purple-900 p-8 pb-20 text-white sm:p-20">
      <SpookyBackground />

      <main className="relative mx-auto flex flex-col items-center justify-center">
        <h1 className="mb-8 text-center text-4xl font-magical animate-magical-glow">
          Record New Purranormal Activity
        </h1>

        <NewLogForm />
      </main>
    </div>
  )
}
