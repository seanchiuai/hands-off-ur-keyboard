export default function ProductSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="h-64 bg-gray-200" />

      {/* Content skeleton */}
      <div className="p-4">
        <div className="flex justify-between mb-4">
          <div className="h-6 bg-gray-200 rounded w-2/3" />
          <div className="h-6 bg-gray-200 rounded w-16" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/6" />
        </div>
        <div className="h-10 bg-gray-200 rounded mt-4" />
      </div>
    </div>
  );
}
