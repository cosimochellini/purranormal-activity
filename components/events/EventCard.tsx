import type { Log } from '../../db/schema'
import classNames from 'classnames'
import Link from 'next/link'
import { getCategories } from '../../utils/categories'
import { Category } from '../common/Category'
import { EventImage } from './EventImage'

interface EventCardProps {
  log: Log
}

const cardClasses = classNames(
  'bg-purple-900/30 backdrop-blur-sm rounded-lg p-6',
  'hover:transform hover:scale-[1.02] transition-all duration-300',
  'hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]',
  'border border-purple-700/30',
  'group',
  'h-full flex flex-col justify-between', // Added classes for fixed height and flexbox
)

export function EventCard({
  log,
}: EventCardProps) {
  const { id, title, description } = log

  const categories = getCategories(log)

  return (
    <Link href={`/${id}`} prefetch>
      <div className={cardClasses}>
        <div className="relative flex justify-center">
          <EventImage
            loading="eager"
            width={240}
            height={240}
            quality={50}
            log={log}
            className="mb-4 group-hover:animate-spooky-shake rounded-md"
          />
        </div>
        <div className="flex-grow">
          <h3 className="font-medium mb-2 transition-colors text-balance">
            {title}
          </h3>
          <p className="text-purple-200/80 line-clamp-4 text-balance">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {categories.map(category => (
            <Category key={category} category={category} iconOnly />
          ))}
        </div>
      </div>
    </Link>
  )
}
