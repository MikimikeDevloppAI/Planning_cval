export default function PlanningLoading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="w-64 h-8 bg-gray-200 rounded" />
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="w-20 h-8 bg-gray-200 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="w-36 h-8 bg-gray-200 rounded" />
          <div className="w-28 h-8 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Legend skeleton */}
      <div className="h-10 bg-gray-100 rounded-lg" />

      {/* Grid skeleton */}
      {[1, 2].map((i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <div className="h-9 bg-gray-300" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex border-b last:border-b-0">
              <div className="w-40 h-16 bg-gray-50 border-r" />
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <div key={k} className="flex-1 h-16 border-r last:border-r-0 p-1">
                  <div className="w-3/4 h-5 bg-gray-100 rounded mb-1" />
                  <div className="w-1/2 h-5 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
