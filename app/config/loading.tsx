export default function ConfigLoading() {
  return (
    <div>
      <div className="h-5 w-64 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-lg border border-gray-200 bg-white animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
