'use client';

import React from 'react';
import { useLedger } from '@/context/LedgerContext';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { RotateCcw } from 'lucide-react';

export default function ResetDialog() {
  const { showResetModal, setShowResetModal, handleResetBooks } = useLedger();

  return (
    <Dialog
      isOpen={showResetModal}
      onClose={() => setShowResetModal(false)}
      title="Reset your books?"
      description="This will clear all transactions, categorization rules, recurring subscriptions, and goals from this browser. This action cannot be undone."
    >
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-4">
        <Button
          variant="outline"
          onClick={() => setShowResetModal(false)}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleResetBooks}
          icon={RotateCcw}
        >
          Yes, reset books
        </Button>
      </div>
    </Dialog>
  );
}
