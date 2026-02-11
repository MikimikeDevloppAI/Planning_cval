export default function StaffLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded animate-pulse mt-2" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 flex-1 max-w-sm bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-10 w-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-200" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-gray-50"
          >
            <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-5 w-12 bg-gray-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
