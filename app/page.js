'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LedgerProvider, useLedger } from '@/context/LedgerContext';
import Header from '@/components/Header';
import TopBar from '@/components/TopBar';
import ResetDialog from '@/components/ResetDialog';
import OverviewTab from '@/components/OverviewTab';
import PasteTab from '@/components/PasteTab';
import LedgerTab from '@/components/LedgerTab';
import QuietLeaksTab from '@/components/QuietLeaksTab';
import PlanTab from '@/components/PlanTab';
import LetterTab from '@/components/LetterTab';

function TabContent() {
  const { activeTab } = useLedger();

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'paste':
        return <PasteTab />;
      case 'ledger':
        return <LedgerTab />;
      case 'leaks':
      case 'quiet-leaks':
        return <QuietLeaksTab />;
      case 'plan':
        return <PlanTab />;
      case 'letter':
        return <LetterTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full"
      >
        {renderTab()}
      </motion.div>
    </AnimatePresence>
  );
}

export function MunshiShell({ initialTab = 'overview' }) {
  return (
    <LedgerProvider initialTab={initialTab}>
      <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
        {/* Navigation Shell (Desktop Sidebar + Mobile Bottom Tabs) */}
        <Header />

        {/* Main Content Area (Offset for Desktop Sidebar 248px) */}
        <div className="flex-1 md:pl-[248px] flex flex-col min-w-0">
          {/* Sticky Blurred Top Bar */}
          <TopBar />

          {/* Page View Body */}
          <main className="flex-1 px-4 sm:px-8 py-6 max-w-6xl w-full mx-auto">
            <TabContent />
          </main>
        </div>

        {/* Global Confirmation Modal */}
        <ResetDialog />
      </div>
    </LedgerProvider>
  );
}

export default function Home() {
  return <MunshiShell initialTab="overview" />;
}
