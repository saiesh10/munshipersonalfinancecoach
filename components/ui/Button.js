'use client';

import React from 'react';
import clsx from 'clsx';

/**
 * Universal Button component.
 * Shapes: 10px radius (control), active:scale-[0.98], focus ring: 2px primary with 2px offset.
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'outline' | 'ghost' | 'danger' | 'icon'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  icon: Icon,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-control focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer';

  const sizeClasses = {
    sm: 'text-[13px] px-3 py-1.5 gap-1.5 h-8',
    md: 'text-[14px] px-4 py-2 gap-2 h-10',
    lg: 'text-[15px] px-5 py-2.5 gap-2.5 h-11'
  }[size] || 'text-[14px] px-4 py-2 gap-2 h-10';

  const iconOnlyClasses = {
    sm: 'w-8 h-8 p-0',
    md: 'w-10 h-10 p-0',
    lg: 'w-11 h-11 p-0'
  }[size] || 'w-10 h-10 p-0';

  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
    outline: 'border border-border bg-surface text-ink hover:bg-canvas hover:border-muted/40 shadow-sm',
    ghost: 'bg-transparent text-ink hover:bg-canvas text-muted hover:text-ink',
    danger: 'bg-danger text-white hover:bg-[#a93226] shadow-sm',
    icon: 'bg-transparent text-muted hover:text-ink hover:bg-canvas'
  }[variant] || 'bg-primary text-white hover:bg-primary-hover';

  const isIconOnly = variant === 'icon' || (!children && Icon);

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        baseClasses,
        isIconOnly ? iconOnlyClasses : sizeClasses,
        variantClasses,
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />}
          {children}
        </>
      )}
    </button>
  );
}
