export function EventCardSkeleton() {
  return (
    <div className="bg-purple-900/30 backdrop-blur-sm rounded-lg p-6 border border-purple-700/30 h-full animate-pulse">
      <div className="flex justify-center">
        <div className="w-[150px] h-[150px] bg-purple-800/30 rounded-md mb-4" />
      </div>
      <div className="space-y-3">
        <div className="h-6 bg-purple-800/30 rounded w-3/4" />
        <div className="space-y-2">
          <div className="h-4 bg-purple-800/30 rounded w-full" />
          <div className="h-4 bg-purple-800/30 rounded w-5/6" />
        </div>
        <div className="flex gap-2 mt-4">
          <div className="h-6 w-6 bg-purple-800/30 rounded-full" />
          <div className="h-6 w-6 bg-purple-800/30 rounded-full" />
          <div className="h-6 w-6 bg-purple-800/30 rounded-full" />
        </div>
      </div>
    </div>
  )
}
