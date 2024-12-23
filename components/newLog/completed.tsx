import Image from 'next/image'
import Link from 'next/link'

import { SpookyButton } from '@/components/common/SpookyButton'
import { randomImage } from '@/images/insert/success'

export function CompletedSection() {
  const successImage = randomImage()

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

      <SpookyButton>
        <Link href="/">
          Go to home
        </Link>
      </SpookyButton>
    </div>
  )
}
