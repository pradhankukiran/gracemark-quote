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
          <div className="h-10 w-80 bg-gray-200 animate-pulse rounded mx-auto" />
          <div className="h-5 w-96 bg-gray-200 animate-pulse rounded mx-auto" />
        </div>

        {/* Provider grid skeleton */}
        <div className="bg-white border border-slate-200 shadow-md p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap justify-center gap-4">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-48 sm:w-56 md:w-60 h-32 bg-gray-200 animate-pulse rounded"
                />
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-48 sm:w-56 md:w-60 h-32 bg-gray-200 animate-pulse rounded"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Variance summary skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 bg-gray-200 animate-pulse rounded"
            />
          ))}
        </div>
      </main>
    </div>
  )
}
