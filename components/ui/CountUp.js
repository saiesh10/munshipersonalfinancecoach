'use client';

import React, { useEffect, useState } from 'react';

/**
 * Animated counter that counts from previous to new value over 600ms.
 * Respects prefers-reduced-motion.
 */
export default function CountUp({
  value = 0,
  prefix = '',
  suffix = '',
  duration = 600,
  decimals = 0,
  className = ''
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // Respect user's motion preferences
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return;
    }

    const startValue = displayValue;
    const endValue = Number(value) || 0;
    if (startValue === endValue) return;

    const startTime = performance.now();

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic: 1 - Math.pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(endValue);
      }
    };

    const animId = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  const formatted = decimals > 0
    ? displayValue.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(displayValue).toLocaleString('en-IN');

  return (
    <span className={`tabular-nums font-semibold ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
