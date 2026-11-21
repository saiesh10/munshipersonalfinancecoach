'use client';

import React, { useState, useMemo } from 'react';
import { useLedger } from '@/context/LedgerContext';
import {
  TrendingUp,
  Moon,
  Layers,
  Repeat,
  ArrowRight,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import Card from './ui/Card';
import Button from './ui/Button';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';
import Segmented from './ui/Segmented';
import CountUp from './ui/CountUp';
import EmptyState from './ui/EmptyState';
import { formatRupees, getCategoryColor } from './ui/format';

export default function QuietLeaksTab() {
  const {
    subscriptions,
    adjustments,
    setAdjustments,
    setActiveTab,
    handleSimulate
  } = useLedger();

  // Track decision per subscription: null | 'keep' | 'cancel'
  const [decisions, setDecisions] = useState({});

  // Compute total annual cost & forgotten count
  const totalAnnualCost = useMemo(() => {
    return subscriptions.reduce((sum, s) => sum + (s.annualCost || 0), 0);
  }, [subscriptions]);

  const forgottenCount = useMemo(() => {
    return subscriptions.filter(s => Array.isArray(s.flags) && s.flags.includes('unused')).length;
  }, [subscriptions]);

  // Compute cancelled annual savings
  const cancelledAnnualSavings = useMemo(() => {
    return subscriptions
      .filter(s => {
        const isExplicitCancel = decisions[s.id] === 'cancel';
        const isPlanSkipped = adjustments.some(a => a.type === 'skip_subscription' && a.target === s.id);
        return isExplicitCancel || isPlanSkipped;
      })
      .reduce((sum, s) => sum + (s.annualCost || 0), 0);
  }, [subscriptions, decisions, adjustments]);

  const handleDecisionChange = (sub, choice) => {
    setDecisions(prev => ({ ...prev, [sub.id]: choice }));

    if (choice === 'cancel') {
      const monthlyAmount = Math.round(sub.annualCost / 12);
      if (!adjustments.some(a => a.type === 'skip_subscription' && a.target === sub.id)) {
        setAdjustments([
          ...adjustments,
          {
            type: 'skip_subscription',
            target: sub.id,
            amount: monthlyAmount
          }
        ]);
      }
      toast.success(`Marked ${sub.merchant} for cancellation. Saved ${formatRupees(sub.annualCost)} a year.`);
    } else if (choice === 'keep') {
      setAdjustments(adjustments.filter(a => !(a.type === 'skip_subscription' && a.target === sub.id)));
      toast(`Kept ${sub.merchant} in recurring plans.`);
    }
  };

  const handleAddToPlan = () => {
    handleSimulate();
    setActiveTab('plan');
  };

  const formatSince = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return 'recent months';
    }
  };

  if (subscriptions.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          title="No recurring subscriptions found"
          description="We search for weekly, monthly, or yearly cadence across your statements. Paste your messages to uncover quiet leaks."
          primaryAction={{
            label: 'Paste messages',
            onClick: () => setActiveTab('paste')
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-24">
      {/* Editorial Headline */}
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[28px] font-normal text-ink leading-tight">
          Quiet Leaks.
        </h2>
        <p className="text-[14px] text-muted">
          Expose forgotten and rising subscriptions. Small recurring charges quietly claim your margin month after month.
        </p>
      </div>

      {/* Header Card with Big Animated Number & Stacked Cost Bar */}
      <Card className="p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <span className="text-[13px] font-medium text-muted block mb-1">
              Annual recurring commitment
            </span>
            <div className="text-[32px] sm:text-[36px] font-semibold text-ink leading-none tabular-nums">
              <CountUp value={totalAnnualCost} prefix="₹" suffix=" a year" />
            </div>
          </div>

          <p className="text-[14px] text-muted max-w-sm sm:text-right">
            {subscriptions.length} {subscriptions.length === 1 ? 'service charges' : 'services charge'} you regularly.
            {forgottenCount > 0 ? ` ${forgottenCount} look forgotten.` : ''}
          </p>
        </div>

        {/* Thin Stacked Share Bar in Category Colors */}
        {totalAnnualCost > 0 && (
          <div className="flex flex-col gap-1.5 pt-2">
            <div className="w-full h-2.5 bg-canvas rounded-full overflow-hidden flex border border-border">
              {subscriptions.map((sub) => {
                const widthPct = Math.max(1, (sub.annualCost / totalAnnualCost) * 100);
                const color = getCategoryColor(sub.merchantKey);
                return (
                  <div
                    key={sub.id}
                    title={`${sub.merchant}: ${formatRupees(sub.annualCost)}`}
                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                    className="h-full transition-all duration-300"
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Cost distributed across {subscriptions.length} active services</span>
              <span>100% of detected cadence</span>
            </div>
          </div>
        )}
      </Card>

      {/* List of Subscription Cards */}
      <div className="flex flex-col gap-3">
        {subscriptions.map((sub) => {
          const isCancelled = decisions[sub.id] === 'cancel' || adjustments.some(a => a.type === 'skip_subscription' && a.target === sub.id);
          const hasFlags = Array.isArray(sub.flags) && sub.flags.length > 0;
          const currentDecision = isCancelled ? 'cancel' : (decisions[sub.id] === 'keep' ? 'keep' : 'keep');

          return (
            <Card
              key={sub.id}
              className={`p-4 sm:p-5 transition-all duration-200 ${
                isCancelled ? 'opacity-60 bg-canvas border-border/50' : 'bg-surface hover:shadow-lift'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left Side: Avatar, Name, Cadence, Annual Cost */}
                <div className="flex items-center gap-3.5">
                  <Avatar name={sub.merchant} category="Subscriptions" size="lg" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[16px] font-semibold text-ink leading-snug ${
                          isCancelled ? 'line-through text-muted' : ''
                        }`}
                      >
                        {sub.merchant}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[13px] text-muted mt-0.5">
                      <span className="font-medium text-ink tabular-nums">
                        {formatRupees(sub.amount)} / {sub.cadence === 'yearly' ? 'year' : 'month'}
                      </span>
                      <span>·</span>
                      <span>since {formatSince(sub.lastDate)}</span>
                      <span>·</span>
                      <span className="tabular-nums font-medium text-ink">
                        {formatRupees(sub.annualCost)} / year
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Segmented Keep / Cancel Control */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <Segmented
                    size="sm"
                    options={[
                      { value: 'keep', label: 'Keep' },
                      { value: 'cancel', label: "I'll cancel it" }
                    ]}
                    value={currentDecision}
                    onChange={(val) => handleDecisionChange(sub, val)}
                    name={`sub-decision-${sub.id}`}
                  />
                </div>
              </div>

              {/* Flag Badges with Icons */}
              {hasFlags && (
                <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                  {sub.flags.includes('price_up') && (
                    <Badge variant="saffron" dot dotColor="#E8890C">
                      <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
                      {sub.flagMessage?.includes('Price went up') ? sub.flagMessage : 'Price went up recently'}
                    </Badge>
                  )}

                  {sub.flags.includes('unused') && (
                    <Badge variant="saffron" dot dotColor="#E8890C">
                      <Moon className="w-3.5 h-3.5 inline mr-1" />
                      {sub.flagMessage?.includes('order') ? sub.flagMessage : 'Unused membership: 0-1 orders in 3 months'}
                    </Badge>
                  )}

                  {sub.flags.includes('overlap') && (
                    <Badge variant="default" dot dotColor="#5E6B64">
                      <Layers className="w-3.5 h-3.5 inline mr-1" />
                      {sub.flagMessage?.includes('Two') ? sub.flagMessage : 'Overlaps with another active subscription'}
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 md:left-[248px] right-0 bg-surface/95 backdrop-blur-md border-t border-border p-4 z-30 shadow-lift flex flex-col sm:flex-row items-center justify-between gap-3 px-6 sm:px-12">
        <div className="flex items-center gap-2 text-[14px] text-ink font-medium">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span>
            If you cancel the ones you marked:{' '}
            <strong className="text-success font-semibold tabular-nums">
              {formatRupees(cancelledAnnualSavings)} a year
            </strong>{' '}
            back in your pocket.
          </span>
        </div>

        <Button
          variant="primary"
          onClick={handleAddToPlan}
          icon={ArrowRight}
          disabled={cancelledAnnualSavings === 0}
        >
          Add to my plan
        </Button>
      </div>
    </div>
  );
}
