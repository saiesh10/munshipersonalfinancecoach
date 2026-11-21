'use client';

import React, { useState, useMemo } from 'react';
import { useLedger } from '@/context/LedgerContext';
import {
  ArrowUpRight,
  Wallet,
  Repeat,
  Target,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ClipboardPaste,
  Database
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip
} from 'recharts';
import Card, { CardHeader } from './ui/Card';
import Stat from './ui/Stat';
import Chip from './ui/Chip';
import Avatar from './ui/Avatar';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import { ProgressRing } from './ui/Progress';
import { formatRupees, getCategoryColor, getCategoryTint } from './ui/format';

export default function OverviewTab() {
  const {
    transactions,
    subscriptions,
    profile,
    goal,
    projection,
    nudges,
    setActiveTab,
    handleLoadSampleData,
    isLoading
  } = useLedger();

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(null);

  // Time-based greeting in Fraunces 28px
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Compute Active Month Debits & Credits (Default: most recent month in transactions or Nov 2026)
  const stats = useMemo(() => {
    const debits = transactions.filter(t => t.direction === 'debit');
    const credits = transactions.filter(t => t.direction === 'credit');

    const totalDebits = debits.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalCredits = credits.reduce((acc, t) => acc + (t.amount || 0), 0);

    const monthlyIncome = profile?.monthlyIncome || totalCredits || 92000;
    const spentThisMonth = totalDebits > 0 ? (projection?.monthlyVariable || totalDebits) : 0;
    const leftThisMonth = Math.max(0, monthlyIncome - (projection?.monthlyFixed || 33000) - spentThisMonth);

    // Goal progress
    const targetAmt = goal?.targetAmount || 500000;
    const savedAmt = goal?.saved || 0;
    const goalPct = Math.min(100, Math.round((savedAmt / Math.max(1, targetAmt)) * 100));

    // Annual subscriptions
    const subAnnualTotal = subscriptions.reduce((acc, s) => acc + (s.annualCost || 0), 0);

    return {
      spentThisMonth,
      leftThisMonth,
      goalPct,
      subAnnualTotal,
      targetAmt,
      savedAmt
    };
  }, [transactions, subscriptions, profile, goal, projection]);

  // Donut Data by Category
  const categoryData = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.direction !== 'debit') continue;
      const cat = t.category || 'Other';
      map[cat] = (map[cat] || 0) + (t.amount || 0);
    }

    const total = Object.values(map).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        color: getCategoryColor(name),
        percentage: total > 0 ? Math.round((value / total) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value);

    return {
      items: sorted,
      total
    };
  }, [transactions]);

  // Cash Flow Monthly Data (Grouped Bar Chart)
  const cashFlowData = useMemo(() => {
    const monthsMap = {};
    for (const t of transactions) {
      if (!t.date) continue;
      const mKey = t.date.slice(0, 7); // YYYY-MM
      if (!monthsMap[mKey]) {
        monthsMap[mKey] = { in: 0, out: 0, date: t.date };
      }
      if (t.direction === 'credit') {
        monthsMap[mKey].in += t.amount || 0;
      } else {
        monthsMap[mKey].out += t.amount || 0;
      }
    }

    const sorted = Object.entries(monthsMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-5)
      .map(([mKey, data]) => {
        const d = new Date(data.date);
        const label = d.toLocaleString('en-US', { month: 'short' });
        return {
          month: label,
          In: data.in,
          Out: data.out
        };
      });

    if (sorted.length === 0) {
      return [
        { month: 'Aug', In: 85000, Out: 58000 },
        { month: 'Sep', In: 88000, Out: 62000 },
        { month: 'Oct', In: 92000, Out: 64000 },
        { month: 'Nov', In: 92000, Out: 61430 }
      ];
    }
    return sorted;
  }, [transactions]);

  // Top Drift Nudge for "Munshi says"
  const topNudge = nudges && nudges.length > 0 ? nudges[0] : null;

  // Recent 6 transactions
  const recentTransactions = transactions.slice(0, 6);

  // If books are completely empty, show friendly empty state
  if (transactions.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          title="Your books are waiting"
          description="Paste your bank SMS or upload a statement to get an instant view of your cash flow, quiet leaks, and trajectory."
          primaryAction={{
            label: 'Paste your messages',
            icon: ClipboardPaste,
            onClick: () => setActiveTab('paste')
          }}
          secondaryAction={{
            label: 'Try sample data',
            icon: Database,
            onClick: handleLoadSampleData
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* Editorial Header Greeting */}
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[28px] font-normal text-ink leading-tight">
          {greeting}. Here's where your money stands.
        </h2>
        <p className="text-[14px] text-muted">
          Track spending, fix quiet leaks, and stay on course to reach {goal?.name || 'your goal'}.
        </p>
      </div>

      {/* Row of 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Spent this month"
          value={stats.spentThisMonth}
          delta={projection?.topOverspend ? `${projection.topOverspend.category} high` : 'Normal pace'}
          deltaType={projection?.topOverspend ? 'negative' : 'neutral'}
          icon={ArrowUpRight}
          iconTint="bg-accent-tint text-accent-saffron"
        />

        <Stat
          label="Left this month"
          value={stats.leftThisMonth}
          delta="Discretionary"
          deltaType="positive"
          icon={Wallet}
          iconTint="bg-primary-tint text-primary"
        />

        <Stat
          label="Goal progress"
          rawDisplay={`${stats.goalPct}%`}
          delta={goal?.targetDate ? new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Oct 2027'}
          deltaType="neutral"
          icon={() => (
            <ProgressRing value={stats.goalPct} max={100} size={32} strokeWidth={3} color="#0E5A44" />
          )}
          iconTint="bg-canvas text-primary"
          onClick={() => setActiveTab('plan')}
        />

        <Stat
          label="Subscriptions / year"
          value={stats.subAnnualTotal}
          delta={`${subscriptions.length} active`}
          deltaType={subscriptions.some(s => s.flags?.length > 0) ? 'negative' : 'neutral'}
          icon={Repeat}
          iconTint="bg-[#F3EEF9] text-[#7A4FB0]"
          onClick={() => setActiveTab('leaks')}
        />
      </div>

      {/* Two Column Grid: Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Chart: Spending by Category Donut (5 cols) */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <CardHeader
            title="Spending by category"
            subtitle="Current month breakdown"
          />

          <div className="relative w-full h-56 flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.items}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={88}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveCategoryIndex(index)}
                  onMouseLeave={() => setActiveCategoryIndex(null)}
                >
                  {categoryData.items.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      opacity={activeCategoryIndex === null || activeCategoryIndex === index ? 1 : 0.4}
                      className="transition-opacity duration-150 cursor-pointer"
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(val) => formatRupees(val)}
                  contentStyle={{
                    background: '#FFFFFF',
                    border: '1px solid #E7E2D8',
                    borderRadius: '10px',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(20, 32, 27, 0.08)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Total</span>
              <span className="text-[20px] font-semibold text-ink tabular-nums">
                {formatRupees(categoryData.total)}
              </span>
            </div>
          </div>

          {/* Category Legend List */}
          <div className="space-y-2 mt-2 pt-3 border-t border-border max-h-48 overflow-y-auto no-scrollbar">
            {categoryData.items.slice(0, 5).map((item, idx) => (
              <div
                key={item.name}
                onMouseEnter={() => setActiveCategoryIndex(idx)}
                onMouseLeave={() => setActiveCategoryIndex(null)}
                className={`flex items-center justify-between text-[13px] p-1.5 rounded-control transition-colors cursor-pointer ${
                  activeCategoryIndex === idx ? 'bg-canvas font-semibold' : 'hover:bg-canvas/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-ink truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums shrink-0">
                  <span className="text-muted text-[12px]">{item.percentage}%</span>
                  <span className="font-medium text-ink">{formatRupees(item.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right Chart: Cash Flow Grouped Bar Chart (7 cols) */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader
            title="Cash flow"
            subtitle="Monthly income vs total outflows"
            action={
              <div className="flex items-center gap-3 text-[12px] font-medium">
                <span className="flex items-center gap-1.5 text-success">
                  <span className="w-2.5 h-2.5 rounded-sm bg-success" /> Money in
                </span>
                <span className="flex items-center gap-1.5 text-primary">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Money out
                </span>
              </div>
            }
          />

          <div className="w-full h-72 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} barGap={6}>
                <XAxis
                  dataKey="month"
                  stroke="#8A948E"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#E7E2D8' }}
                />
                <YAxis
                  stroke="#8A948E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${Math.round(val / 1000)}k`}
                />
                <RechartsTooltip
                  formatter={(val) => formatRupees(val)}
                  contentStyle={{
                    background: '#FFFFFF',
                    border: '1px solid #E7E2D8',
                    borderRadius: '10px',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(20, 32, 27, 0.08)'
                  }}
                />
                <Bar dataKey="In" fill="#1B7F5C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Out" fill="#0E5A44" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-[13px] text-muted">
            <span>Consistent savings rate preserves your arrival milestone.</span>
            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className="font-medium text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer"
            >
              <span>Explore plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>
      </div>

      {/* Two Column Grid: "Munshi Says" Insight + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* "Munshi says" Insight Card (5 cols) */}
        <Card className="lg:col-span-5 bg-gradient-to-br from-surface to-canvas flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-control bg-accent-tint text-accent-saffron flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 stroke-[2]" />
              </div>
              <h3 className="font-semibold text-[16px] text-ink">Munshi says</h3>
            </div>

            <p className="text-[14px] text-ink leading-relaxed">
              {topNudge?.message ||
                "You are maintaining a steady pace this month. Keeping an eye on daily conveniences will secure your emergency corpus ahead of schedule."}
            </p>

            {subscriptions.some(s => s.flags?.includes('unused')) && (
              <div className="mt-4 p-3 bg-accent-tint/60 border border-accent-saffron/20 rounded-control flex items-start gap-2.5">
                <TrendingUp className="w-4 h-4 text-accent-saffron shrink-0 mt-0.5" />
                <p className="text-[13px] text-ink leading-snug">
                  You have unutilized subscriptions that can save{' '}
                  <strong>{formatRupees(14376)}</strong> a year if trimmed.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
            <span className="text-[12px] text-muted">Actionable adjustment</span>
            <Button
              variant="primary"
              size="sm"
              icon={ArrowRight}
              onClick={() => setActiveTab('plan')}
            >
              See the plan
            </Button>
          </div>
        </Card>

        {/* Recent Transactions (7 cols) */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader
            title="Recent transactions"
            subtitle="Latest activity recorded in your ledger"
            action={
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className="text-[13px] font-medium text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          />

          <div className="divide-y divide-border -mx-5 px-5">
            {recentTransactions.map((txn) => {
              const isCredit = txn.direction === 'credit';
              return (
                <div
                  key={txn.id}
                  onClick={() => setActiveTab('ledger')}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-canvas/50 px-2 rounded-control transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 truncate">
                    <Avatar name={txn.merchant} category={txn.category} size="md" />
                    <div className="flex flex-col truncate">
                      <span className="text-[14px] font-medium text-ink truncate leading-snug">
                        {txn.merchant}
                      </span>
                      <span className="text-[12px] text-muted">
                        {txn.date ? new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Chip
                      label={txn.category}
                      category={txn.category}
                      className="hidden sm:inline-flex"
                    />
                    <span
                      className={`text-[14px] font-semibold tabular-nums ${
                        isCredit ? 'text-success' : 'text-ink'
                      }`}
                    >
                      {formatRupees(txn.amount, { showPlus: isCredit })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
