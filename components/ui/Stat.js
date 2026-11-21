'use client';

import React from 'react';
import Card from './Card';
import CountUp from './CountUp';

export default function Stat({
  label,
  value,
  prefix = '₹',
  suffix = '',
  delta,
  deltaType = 'neutral', // 'positive' | 'negative' | 'neutral'
  icon: Icon,
  iconTint = 'bg-primary-tint text-primary',
  rawDisplay,
  onClick
}) {
  const deltaColorClasses = {
    positive: 'text-success bg-primary-tint',
    negative: 'text-danger bg-danger-tint',
    neutral: 'text-muted bg-canvas'
  }[deltaType] || 'text-muted bg-canvas';

  return (
    <Card
      onClick={onClick}
      hover={Boolean(onClick)}
      className="flex flex-col justify-between p-4 sm:p-5 h-full"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {Icon && (
          <div className={`w-9 h-9 rounded-control flex items-center justify-center shrink-0 ${iconTint}`}>
            <Icon className="w-4 h-4 stroke-[1.75]" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-auto">
        <div className="text-[26px] sm:text-[28px] font-semibold text-ink leading-none tracking-tight">
          {rawDisplay ? (
            rawDisplay
          ) : (
            <CountUp value={value} prefix={prefix} suffix={suffix} />
          )}
        </div>

        {delta && (
          <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${deltaColorClasses}`}>
            {delta}
          </span>
        )}
      </div>
    </Card>
  );
}
