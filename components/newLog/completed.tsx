import { SpookyButton } from '@/components/common/SpookyButton'
import { randomImage } from '@/images/insert/success'

import Image from 'next/image'
import { useSound } from '../../hooks/useSound'
import { TransitionLink } from '../common/TransitionLink'

interface CompletedSectionProps {
  logId?: number
}

export function CompletedSection({ logId }: CompletedSectionProps) {
  const successImage = randomImage()

  useSound('/sounds/magic.mp3', { autoplay: true })

  return (
    <div className="flex flex-col w-full items-center justify-center gap-4">
      <div className="rounded-md p-4 bg-green-900/30">
        Log created successfully
      </div>
      <div className="relative w-full aspect-square max-w-3xl mx-auto rounded-md overflow-hidden">
        <Image
          src={successImage}
          blurDataURL={successImage.blurDataURL}
          placeholder="blur"
          alt="Success"
          fill
          className="object-contain"
        />
      </div>

      <div className="flex gap-4 justify-center w-full">
        <TransitionLink href="/">
          <SpookyButton>
            Go to home
          </SpookyButton>
        </TransitionLink>

        <TransitionLink href={`/${logId}`}>
          <SpookyButton>
            View log
          </SpookyButton>
        </TransitionLink>
      </div>
    </div>
  )
}
