import React from 'react';

/**
 * Three-dot bouncing loading animation.
 * Usage: <LoadingDots /> or <LoadingDots size="sm" /> or wrapped in a container.
 */
export default function LoadingDots({ size = 'md', label = 'Loading…' }) {
  const dotClass = size === 'sm'
    ? 'w-1.5 h-1.5'
    : size === 'lg'
    ? 'w-3.5 h-3.5'
    : 'w-2.5 h-2.5';

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-2">
      <div className="flex items-center gap-1.5" role="status" aria-label={label}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`${dotClass} bg-blue-500 rounded-full animate-bounce`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      {label && (
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      )}
    </div>
  );
}

/**
 * Full-page centered loading dots for use inside flex containers.
 */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center h-48 w-full">
      <LoadingDots label={label} />
    </div>
  );
}
