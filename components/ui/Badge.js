'use client';

import React from 'react';
import clsx from 'clsx';

export default function Badge({
  children,
  variant = 'default', // 'default' | 'primary' | 'saffron' | 'danger' | 'success' | 'outline'
  dot = false,
  dotColor,
  className = ''
}) {
  const variantStyles = {
    default: 'bg-canvas text-muted border border-border',
    primary: 'bg-primary-tint text-primary border border-primary/20',
    saffron: 'bg-accent-tint text-accent-saffron border border-accent-saffron/20',
    danger: 'bg-danger-tint text-danger border border-danger/20',
    success: 'bg-primary-tint text-success border border-success/20',
    outline: 'bg-transparent text-ink border border-border'
  }[variant] || 'bg-canvas text-muted border border-border';

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium leading-none select-none',
        variantStyles,
        className
      )}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor || 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
}
