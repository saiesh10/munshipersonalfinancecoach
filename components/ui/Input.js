'use client';

import React from 'react';
import clsx from 'clsx';
import { Plus, Minus } from 'lucide-react';

export default function Input({
  label,
  helper,
  error,
  prefix,
  stepper = false,
  step = 1000,
  min,
  max,
  value,
  onChange,
  type = 'text',
  className = '',
  placeholder = '',
  disabled = false,
  ...props
}) {
  const handleStep = (delta) => {
    if (disabled || onChange == null) return;
    const current = Number(value) || 0;
    const nextVal = current + delta;
    if (min !== undefined && nextVal < min) return;
    if (max !== undefined && nextVal > max) return;
    onChange({ target: { value: nextVal } });
  };

  return (
    <div className={clsx('flex flex-col gap-1 w-full', className)}>
      {label && (
        <label className="text-[13px] font-medium text-ink flex items-center justify-between">
          <span>{label}</span>
        </label>
      )}

      <div className="relative flex items-center w-full">
        {prefix && (
          <span className="absolute left-3 text-muted text-[14px] font-medium select-none pointer-events-none">
            {prefix}
          </span>
        )}

        <input
          type={type}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={clsx(
            'w-full bg-surface border rounded-control text-[14px] text-ink placeholder:text-muted/60 transition-all duration-150',
            'h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            prefix ? 'pl-7' : 'pl-3',
            stepper ? 'pr-20' : 'pr-3',
            error ? 'border-danger focus:ring-danger' : 'border-border focus:border-primary',
            disabled && 'bg-canvas text-muted/60 cursor-not-allowed'
          )}
          {...props}
        />

        {stepper && (
          <div className="absolute right-1.5 flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleStep(-step)}
              className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted hover:text-ink hover:bg-canvas border border-border active:scale-95 transition-all cursor-pointer disabled:opacity-40"
              aria-label="Decrease"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleStep(step)}
              className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted hover:text-ink hover:bg-canvas border border-border active:scale-95 transition-all cursor-pointer disabled:opacity-40"
              aria-label="Increase"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {helper && !error && <span className="text-[12px] text-muted leading-tight">{helper}</span>}
      {error && <span className="text-[12px] text-danger leading-tight">{error}</span>}
    </div>
  );
}
