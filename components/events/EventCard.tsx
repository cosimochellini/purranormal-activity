import classNames from 'classnames'
import { memo } from 'react'
import type { LogWithCategories } from '../../db/schema'

import { transitions } from '../../utils/viewTransition'
import { Category } from '../common/Category'
import { TransitionLink } from '../common/TransitionLink'
import { EventImage } from './EventImage'

interface EventCardProps {
  log: LogWithCategories

  priority?: boolean
  prefetch?: boolean
}

const cardClasses = classNames(
  'bg-purple-900/30 backdrop-blur-xs rounded-lg p-6',
  'hover:transform hover:scale-[1.02] transition-all duration-300',
  'hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]',
  'border border-purple-700/30',
  'group',
  'h-full flex flex-col justify-between',
)

function EventCardComponent({ log, priority, prefetch = false }: EventCardProps) {
  const { id, title, description, categories } = log

  const styles = transitions(id)

  return (
    <TransitionLink href={`/${id}`} prefetch={prefetch}>
      <div className={cardClasses}>
        <div className="relative flex justify-center mb-4">
          <div className="relative w-full aspect-square overflow-hidden rounded-md">
            <EventImage
              priority={priority}
              loading={priority ? 'eager' : 'lazy'}
              width={300}
              height={300}
              quality={75}
              log={log}
              className="group-hover:animate-spooky-shake object-cover w-full h-full"
              style={styles.image}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        </div>
        <div className="grow">
          <h3 className="font-medium mb-2 transition-colors text-balance" style={styles.title}>
            {title}
          </h3>
          <p className="text-purple-200/80 line-clamp-4 text-balance" style={styles.description}>
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4" style={styles.categories}>
          {categories.map((category) => (
            <Category key={category} category={category} iconOnly />
          ))}
        </div>
      </div>
    </TransitionLink>
  )
}

export const EventCard = memo(EventCardComponent)
