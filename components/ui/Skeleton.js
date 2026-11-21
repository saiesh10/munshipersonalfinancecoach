'use client';

import React from 'react';
import clsx from 'clsx';

export default function Skeleton({ className = '', rounded = 'rounded-control' }) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-canvas border border-border/50',
        rounded,
        className
      )}
    />
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2 w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 bg-surface rounded-card border border-border p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="w-28 h-3.5" />
              <Skeleton className="w-16 h-2.5" />
            </div>
          </div>
          <Skeleton className="w-20 h-6 rounded-full" />
          <Skeleton className="w-16 h-4" />
        </div>
      ))}
    </div>
  );
}
