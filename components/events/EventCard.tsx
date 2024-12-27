import classNames from 'classnames'
import Link from 'next/link'
import { EventImage } from './EventImage'

interface EventCardProps {
  id: number
  title: string
  description: string
  imageUrl: string
  imageAlt: string
}
const cardClasses = classNames(
  'bg-purple-900/30 backdrop-blur-sm rounded-lg p-6',
  'hover:transform hover:scale-[1.02] transition-all duration-300',
  'hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]',
  'border border-purple-700/30',
  'group',
)

export function EventCard({
  id,
  title,
  description,
  imageUrl,
  imageAlt,
}: EventCardProps) {
  return (
    <Link href={`/${id}`} prefetch>
      <div className={cardClasses}>
        <div className="relative flex justify-center">
          <EventImage imageUrl={imageUrl} imageAlt={imageAlt} />

        </div>
        <h3 className="font-medium mb-2 transition-colors">
          {title}
        </h3>
        <p className="text-purple-200/80">{description}</p>
      </div>
    </Link>
  )
}
