'use client';

import React from 'react';
import { useLedger } from '@/context/LedgerContext';
import {
  LayoutDashboard,
  ClipboardPaste,
  BookOpen,
  Repeat,
  Target,
  Sparkles,
  BookOpenCheck,
  RotateCcw
} from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Header() {
  const { activeTab, setActiveTab, setShowResetModal, transactions } = useLedger();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'paste', label: 'Paste', icon: ClipboardPaste },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'leaks', label: 'Quiet leaks', icon: Repeat },
    { id: 'plan', label: 'Plan', icon: Target },
    { id: 'letter', label: 'Future You', icon: Sparkles }
  ];

  const currentTab = (activeTab === 'quiet-leaks') ? 'leaks' : activeTab;

  return (
    <>
      {/* Desktop Sidebar: 248px, White, Right Border */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-[248px] bg-surface border-r border-border z-40 p-4 justify-between select-none">
        {/* Top: Logo & Nav */}
        <div className="flex flex-col gap-6">
          {/* Logo Mark + Title + Tagline */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="w-10 h-10 rounded-control bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
              <BookOpenCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[20px] font-semibold text-ink leading-none tracking-tight">
                Munshi
              </span>
              <span className="text-[13px] text-muted mt-1 leading-none font-normal">
                Personal finance coach
              </span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    'relative flex items-center gap-3 px-3.5 py-2.5 rounded-control text-[14px] font-medium transition-colors duration-150 cursor-pointer text-left',
                    isActive
                      ? 'text-primary bg-primary-tint font-semibold'
                      : 'text-muted hover:text-ink hover:bg-canvas'
                  )}
                >
                  {/* Active Indicator on the left */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActiveIndicator"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full"
                      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    />
                  )}
                  <Icon className={clsx('w-4 h-4 stroke-[1.75]', isActive ? 'text-primary' : 'text-muted')} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom of Sidebar: Books Status Card + Reset Button */}
        <div className="flex flex-col gap-3 pt-4 border-t border-border">
          {/* Status Card */}
          <div className="p-3 bg-canvas border border-border rounded-control flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[12px] font-medium text-ink">Up to date as of 21 Nov 2026</span>
            </div>
            <span className="text-[11px] text-muted pl-4">
              {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'} in ledger
            </span>
          </div>

          {/* Reset Books Ghost Button */}
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-muted hover:text-danger hover:bg-danger-tint rounded-control transition-colors cursor-pointer text-left"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset books</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/95 backdrop-blur-md border-t border-border z-40 flex items-center justify-around px-2 select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                'flex flex-col items-center justify-center py-1 px-2 rounded-control gap-1 transition-colors cursor-pointer min-w-[50px]',
                isActive ? 'text-primary font-semibold' : 'text-muted hover:text-ink'
              )}
            >
              <Icon className="w-5 h-5 stroke-[1.75]" />
              <span className="text-[10px] leading-none whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
