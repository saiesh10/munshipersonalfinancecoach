'use client';

import React, { useState } from 'react';
import clsx from 'clsx';

export default function Slider({
  min = -50,
  max = 50,
  step = 5,
  value = 0,
  onChange,
  className = '',
  formatTooltip = (val) => `${val > 0 ? '+' : ''}${val}%`
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div
      className={clsx('relative flex items-center w-full py-2 group', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip bubble on hover/drag */}
      {(isHovered || isDragging) && (
        <div
          className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 bg-ink text-white text-[11px] font-mono rounded-[5px] shadow-sm pointer-events-none whitespace-nowrap z-20"
          style={{ left: `${percentage}%` }}
        >
          {formatTooltip(value)}
        </div>
      )}

      {/* Track Background */}
      <div className="relative w-full h-2 bg-canvas border border-border rounded-full overflow-hidden">
        {/* Filled Portion */}
        <div
          className="h-full bg-primary transition-all duration-75"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Hidden Native Range Input with Custom Styled Thumb */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />

      {/* Visual Thumb */}
      <div
        className="absolute w-4 h-4 bg-surface border-2 border-primary rounded-full shadow-sm pointer-events-none -translate-x-1/2 transition-transform duration-75 group-hover:scale-110"
        style={{ left: `${percentage}%` }}
      />
    </div>
  );
}
