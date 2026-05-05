export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Back link skeleton */}
        <div className="mb-6">
          <div className="h-5 w-16 bg-gray-200 animate-pulse rounded" />
        </div>

        {/* Header skeleton */}
        <div className="text-center space-y-3 mb-8">
          <div className="h-10 w-96 bg-gray-200 animate-pulse rounded mx-auto" />
          <div className="h-5 w-2xl max-w-full bg-gray-200 animate-pulse rounded mx-auto" />
        </div>

        {/* Form card skeleton */}
        <div className="border-0 shadow-lg bg-white/80 backdrop-blur-sm rounded-lg p-6 space-y-6">
          {/* Section: ~7 input rows */}
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
              <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />
            </div>
          ))}

          {/* Action buttons skeleton */}
          <div className="flex gap-3 pt-4">
            <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
            <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
          </div>
        </div>
      </main>
    </div>
  )
}
