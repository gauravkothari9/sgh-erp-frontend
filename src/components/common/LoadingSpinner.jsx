export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' };
  return (
    <div
      className={`${sizes[size]} border-2 border-brand-200 border-t-brand-600
                  rounded-full animate-spin ${className}`}
    />
  );
};

export const PageLoader = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
    <Spinner size="lg" />
    <p className="text-sm text-gray-400">{message}</p>
  </div>
);

export const SkeletonRow = ({ cols = 5 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3.5">
        <div className="h-4 bg-gray-100 rounded animate-pulse" />
      </td>
    ))}
  </tr>
);

export const CardSkeleton = () => (
  <div className="card animate-pulse">
    <div className="h-5 bg-gray-100 rounded w-2/3 mb-3" />
    <div className="h-3 bg-gray-100 rounded w-1/3 mb-5" />
    <div className="h-8 bg-gray-100 rounded w-1/2" />
  </div>
);
