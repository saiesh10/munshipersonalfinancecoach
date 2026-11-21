'use client';

import React, { useState } from 'react';
import { useLedger } from '@/context/LedgerContext';
import { ChevronLeft, ChevronRight, Database } from 'lucide-react';
import Button from './ui/Button';

export default function TopBar({ onMonthChange }) {
  const { activeTab, handleLoadSampleData, isLoading, transactions } = useLedger();

  // Tab Titles
  const titles = {
    overview: 'Overview',
    paste: 'Paste messages',
    ledger: 'Ledger',
    leaks: 'Quiet leaks',
    'quiet-leaks': 'Quiet leaks',
    plan: 'Plan your future',
    letter: 'Future You'
  };

  const currentTitle = titles[activeTab] || 'Overview';

  // Month navigation: default to November 2026
  const months = ['Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026'];
  const [currentMonthIndex, setCurrentMonthIndex] = useState(3); // 'Nov 2026'

  const handlePrevMonth = () => {
    const nextIdx = Math.max(0, currentMonthIndex - 1);
    setCurrentMonthIndex(nextIdx);
    if (onMonthChange) onMonthChange(months[nextIdx]);
  };

  const handleNextMonth = () => {
    const nextIdx = Math.min(months.length - 1, currentMonthIndex + 1);
    setCurrentMonthIndex(nextIdx);
    if (onMonthChange) onMonthChange(months[nextIdx]);
  };

  return (
    <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border h-16 px-4 sm:px-8 flex items-center justify-between gap-4">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-[20px] font-semibold text-ink leading-tight">{currentTitle}</h1>
      </div>

      {/* Right controls: Month Picker + Load Sample Data */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Month Picker */}
        <div className="flex items-center bg-canvas border border-border rounded-control p-0.5">
          <button
            type="button"
            disabled={currentMonthIndex === 0}
            onClick={handlePrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted hover:text-ink hover:bg-surface disabled:opacity-30 transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-medium text-ink px-2 select-none whitespace-nowrap">
            {months[currentMonthIndex]}
          </span>
          <button
            type="button"
            disabled={currentMonthIndex === months.length - 1}
            onClick={handleNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted hover:text-ink hover:bg-surface disabled:opacity-30 transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Load Sample Data Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadSampleData}
          loading={isLoading}
          icon={Database}
          className="hidden sm:inline-flex"
        >
          Sample data
        </Button>
      </div>
    </header>
  );
}
