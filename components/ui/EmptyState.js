'use client';

import React from 'react';
import Button from './Button';

export default function EmptyState({
  title = 'Your books are waiting',
  description = 'Paste your bank SMS or statement to get an instant view of where your money goes.',
  primaryAction,
  secondaryAction,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center max-w-md mx-auto ${className}`}>
      {/* Friendly Inline SVG Illustration: Open ledger and coin */}
      <div className="w-24 h-24 mb-5 text-primary">
        <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Ledger book */}
          <rect x="18" y="24" width="60" height="48" rx="8" fill="#FEF9EE" stroke="#E7E2D8" strokeWidth="2.5" />
          <path d="M48 24V72" stroke="#E7E2D8" strokeWidth="2" strokeDasharray="3 3" />
          {/* Ruled lines in ledger */}
          <line x1="26" y1="36" x2="42" y2="36" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" />
          <line x1="26" y1="46" x2="38" y2="46" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" />
          <line x1="26" y1="56" x2="40" y2="56" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" />
          
          <line x1="54" y1="36" x2="70" y2="36" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" />
          <line x1="54" y1="46" x2="66" y2="46" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" />
          <line x1="54" y1="56" x2="68" y2="56" stroke="#8A948E" strokeWidth="2" strokeLinecap="round" />

          {/* Golden Rupee Coin */}
          <circle cx="68" cy="28" r="16" fill="#FDF1DD" stroke="#E8890C" strokeWidth="2.5" />
          <text
            x="68"
            y="34"
            textAnchor="middle"
            fill="#E8890C"
            fontFamily="system-ui, sans-serif"
            fontWeight="bold"
            fontSize="16"
          >
            ₹
          </text>
        </svg>
      </div>

      <h3 className="font-semibold text-[20px] text-ink mb-1.5">{title}</h3>
      <p className="text-[14px] text-muted leading-relaxed mb-6">{description}</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryAction && (
          <Button
            variant="primary"
            onClick={primaryAction.onClick}
            icon={primaryAction.icon}
          >
            {primaryAction.label}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant="outline"
            onClick={secondaryAction.onClick}
            icon={secondaryAction.icon}
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
