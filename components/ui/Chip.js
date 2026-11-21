'use client';

import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { getCategoryColor, getCategoryTint } from './format';

export default function Chip({
  label,
  category,
  dotColor,
  interactive = false,
  active = false,
  onClick,
  showChevron = false,
  className = ''
}) {
  const color = dotColor || (category ? getCategoryColor(category) : '#5E6B64');
  const tint = category ? getCategoryTint(category) : '#FEF9EE';

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={clsx(
        'group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control text-[13px] font-medium transition-all duration-150 border',
        interactive
          ? 'cursor-pointer hover:border-muted/40 hover:shadow-sm active:scale-[0.98]'
          : 'cursor-default',
        active ? 'border-primary ring-1 ring-primary' : 'border-border',
        className
      )}
      style={{ backgroundColor: tint, color: '#14201B' }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{label || category || 'Unassigned'}</span>
      {showChevron && (
        <ChevronDown className="w-3.5 h-3.5 text-muted group-hover:text-ink transition-transform duration-150" />
      )}
    </button>
  );
}
