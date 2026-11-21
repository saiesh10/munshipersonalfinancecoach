'use client';

import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export default function Select({
  label,
  value,
  onChange,
  options = [],
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <div className={clsx('flex flex-col gap-1 w-full', className)}>
      {label && <label className="text-[13px] font-medium text-ink">{label}</label>}
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full appearance-none bg-surface border border-border rounded-control h-10 pl-3 pr-8 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all cursor-pointer disabled:opacity-50"
          {...props}
        >
          {options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const text = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={val} value={val}>
                {text}
              </option>
            );
          })}
        </select>
        <ChevronDown className="absolute right-3 w-4 h-4 text-muted pointer-events-none stroke-[1.75]" />
      </div>
    </div>
  );
}
