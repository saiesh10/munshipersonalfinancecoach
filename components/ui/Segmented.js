'use client';

import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Segmented({
  options = [],
  value,
  onChange,
  size = 'md', // 'sm' | 'md'
  className = '',
  name = 'segmented'
}) {
  return (
    <div
      className={clsx(
        'inline-flex p-1 bg-canvas border border-border rounded-control relative select-none',
        className
      )}
    >
      {options.map((opt) => {
        const optVal = typeof opt === 'object' ? opt.value : opt;
        const optLabel = typeof opt === 'object' ? opt.label : opt;
        const optIcon = typeof opt === 'object' ? opt.icon : null;
        const isSelected = value === optVal;

        return (
          <button
            key={optVal}
            type="button"
            onClick={() => onChange(optVal)}
            className={clsx(
              'relative z-10 flex items-center justify-center gap-1.5 font-medium rounded-[8px] transition-colors duration-150 cursor-pointer',
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
              isSelected ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
            )}
          >
            {isSelected && (
              <motion.div
                layoutId={`segmented-active-${name}`}
                className="absolute inset-0 bg-surface rounded-[8px] shadow-sm z-[-1]"
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              />
            )}
            {optIcon && <span className="w-3.5 h-3.5">{optIcon}</span>}
            <span>{optLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
