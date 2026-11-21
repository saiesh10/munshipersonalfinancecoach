'use client';

import React from 'react';
import clsx from 'clsx';

export default function Card({
  children,
  className = '',
  hover = false,
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-surface rounded-card border border-border shadow-card p-5 transition-all duration-150',
        hover && 'hover:shadow-lift hover:border-muted/30 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 mb-4', className)}>
      <div>
        {title && <h3 className="font-semibold text-[16px] text-ink leading-tight">{title}</h3>}
        {subtitle && <p className="text-[13px] text-muted mt-0.5 leading-snug">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
