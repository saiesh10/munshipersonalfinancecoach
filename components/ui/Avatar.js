'use client';

import React from 'react';
import clsx from 'clsx';
import { getCategoryColor, getCategoryTint } from './format';

export default function Avatar({
  name = 'Unknown',
  category,
  size = 'md', // 'sm' | 'md' | 'lg'
  className = ''
}) {
  const initial = (name || 'U').charAt(0).toUpperCase();
  const color = category ? getCategoryColor(category) : '#0E5A44';
  const tint = category ? getCategoryTint(category) : '#E6F2EC';

  const sizeClasses = {
    sm: 'w-7 h-7 text-[12px]',
    md: 'w-9 h-9 text-[14px]',
    lg: 'w-11 h-11 text-[16px]'
  }[size] || 'w-9 h-9 text-[14px]';

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold select-none shrink-0 border border-border/40',
        sizeClasses,
        className
      )}
      style={{ backgroundColor: tint, color: color }}
    >
      {initial}
    </div>
  );
}
