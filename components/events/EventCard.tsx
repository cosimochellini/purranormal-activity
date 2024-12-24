import classNames from 'classnames'
import { EventImage } from './EventImage'

interface EventCardProps {
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
  title,
  description,
  imageUrl,
  imageAlt,
}: EventCardProps) {
  return (
    <div className={cardClasses}>
      <div className="relative flex justify-center">
        <EventImage imageUrl={imageUrl} imageAlt={imageAlt} />

      </div>
      <h3 className="font-medium mb-2 transition-colors">
        {title}
      </h3>
      <p className="text-purple-200/80">{description}</p>
    </div>
  )
}
EventCard.Skeleton = function EventCardSkeleton() {
  return (
    <div className={classNames(cardClasses, 'animate-pulse my-4')}>
      <div className="h-10 m-2 w-full bg-purple-700/30 rounded-full" />
      <div className="h-10 m-2 w-full bg-purple-700/30 rounded-full" />
    </div>
  )
}
