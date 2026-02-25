import { IconSparkles } from '@tabler/icons-react'
import { useState } from 'react'
import { SpookyButton } from '@/components/common/SpookyButton'
import { randomImage } from '@/images/insert/success'
import { useSound } from '../../hooks/useSound'
import { TransitionLink } from '../common/TransitionLink'
import { MissingCategoriesModal } from './MissingCategoriesModal'

interface CompletedSectionProps {
  logId?: number
  missingCategories?: string[]
}

const successImage = randomImage()
export function CompletedSection({ logId, missingCategories }: CompletedSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const imageSrc = typeof successImage === 'string' ? successImage : successImage.src

  useSound('/sounds/magic.mp3', { autoplay: true })

  return (
    <>
      <div className="flex flex-col w-full items-center justify-center gap-4">
        <div className="relative rounded-lg border border-green-500/30 bg-green-900/30 px-8 py-4 backdrop-blur-xs">
          {/* Magical sparkles */}
          <div className="absolute -top-4 left-1/4 h-2 w-2 animate-sparkle rounded-full bg-green-300/80 blur-[1px]" />
          <div className="absolute -bottom-2 right-1/3 h-2 w-2 animate-sparkle delay-300 rounded-full bg-green-300/80 blur-[1px]" />

          <div className="flex items-center gap-2 text-lg font-magical">
            <IconSparkles className="h-5 w-5 text-green-400" />
            <span className="animate-magical-glow">Log saved!</span>
            <IconSparkles className="h-5 w-5 text-green-400" />
          </div>
        </div>

        <div className="relative w-full aspect-square max-w-3xl mx-auto rounded-lg overflow-hidden group">
          {/* Magical glow effects */}
          <div className="absolute inset-0 -m-4 animate-pulse rounded-xl bg-purple-500/10 blur-2xl" />
          <div className="absolute inset-0 -m-2 animate-pulse delay-300 rounded-xl bg-purple-600/5 blur-xl" />

          <img
            src={imageSrc}
            alt="Success"
            className="object-contain transition-transform duration-700 group-hover:scale-105 w-full h-full"
          />
        </div>

        {(missingCategories?.length ?? 0) > 0 && (
          <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-900/30 p-4 backdrop-blur-xs">
            <p className="mb-2 font-magical text-amber-200">Mystical Categories Discovered!</p>
            <SpookyButton variant="primary" onClick={() => setIsModalOpen(true)} className="w-full">
              View New Categories
            </SpookyButton>
          </div>
        )}

        <div className="flex gap-4 justify-center w-full">
          <TransitionLink href="/">
            <SpookyButton>Home</SpookyButton>
          </TransitionLink>

          <TransitionLink href={`/${logId}`}>
            <SpookyButton>View log</SpookyButton>
          </TransitionLink>
        </div>
      </div>

      <MissingCategoriesModal
        logId={logId ?? 0}
        missingCategories={missingCategories ?? []}
        onClose={() => setIsModalOpen(false)}
        open={isModalOpen}
      />
    </>
  )
}
