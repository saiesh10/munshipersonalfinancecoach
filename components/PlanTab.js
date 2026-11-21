'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLedger } from '@/context/LedgerContext';
import {
  TrendingUp,
  CheckCircle2,
  Trash2,
  Plus,
  HelpCircle,
  Pizza,
  Home as HomeIcon,
  Repeat,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine
} from 'recharts';
import Card, { CardHeader } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Popover from './ui/Popover';
import Slider from './ui/Slider';
import Badge from './ui/Badge';
import { formatRupees } from './ui/format';

export default function PlanTab() {
  const {
    profile,
    setProfile,
    goal,
    setGoal,
    adjustments,
    setAdjustments,
    projection,
    nudges,
    handleSimulate,
    setActiveTab
  } = useLedger();

  // Local state for category cut sliders (-50% to +50%) and rent delta
  const [categoryCuts, setCategoryCuts] = useState({});
  const [rentDelta, setRentDelta] = useState(0);

  const debounceTimerRef = useRef(null);

  // Sync adjustments to local sliders on load
  useEffect(() => {
    const cuts = {};
    let rent = 0;
    for (const a of adjustments) {
      if (a.type === 'category_cut') {
        cuts[a.target] = Math.round((a.changePct || 0) * 100);
      } else if (a.type === 'rent_delta') {
        rent = a.amount || 0;
      }
    }
    setCategoryCuts(cuts);
    setRentDelta(rent);
  }, [adjustments]);

  // Initial simulation calculation
  useEffect(() => {
    handleSimulate();
  }, []);

  const triggerSimulation = (newCuts, newRent, currentProfile = profile, currentGoal = goal) => {
    const nextAdjustments = [];

    // Keep active skipped subscriptions
    for (const a of adjustments) {
      if (a.type === 'skip_subscription') {
        nextAdjustments.push(a);
      }
    }

    // Category cuts
    for (const [cat, pct] of Object.entries(newCuts)) {
      if (pct !== 0) {
        nextAdjustments.push({
          type: 'category_cut',
          target: cat,
          changePct: pct / 100
        });
      }
    }

    // Rent delta
    if (newRent !== 0) {
      nextAdjustments.push({
        type: 'rent_delta',
        target: 'Rent',
        amount: Number(newRent)
      });
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleSimulate(nextAdjustments, currentProfile, currentGoal);
    }, 200);
  };

  const handleSliderChange = (category, value) => {
    const updated = { ...categoryCuts, [category]: Number(value) };
    setCategoryCuts(updated);
    triggerSimulation(updated, rentDelta);
  };

  const handleRentStep = (stepAmt) => {
    const updated = (rentDelta || 0) + stepAmt;
    setRentDelta(updated);
    triggerSimulation(categoryCuts, updated);
  };

  // Preset Handlers
  const handlePresetCutDelivery = () => {
    const topCat = projection?.topOverspend?.category || projection?.topCategories?.[0]?.category || 'Food & Dining';
    const updated = { ...categoryCuts, [topCat]: -30 };
    setCategoryCuts(updated);
    triggerSimulation(updated, rentDelta);
  };

  const handlePresetRentUp = () => {
    const updated = (rentDelta || 0) + 3000;
    setRentDelta(updated);
    triggerSimulation(categoryCuts, updated);
  };

  const handlePresetSkipSub = () => {
    const sampleSubAdj = {
      type: 'skip_subscription',
      target: 'sample_sub',
      amount: 499
    };
    if (!adjustments.some(a => a.type === 'skip_subscription')) {
      const nextAdj = [...adjustments, sampleSubAdj];
      setAdjustments(nextAdj);
      handleSimulate(nextAdj);
    }
  };

  const handleResetAdjustments = () => {
    setCategoryCuts({});
    setRentDelta(0);
    setAdjustments([]);
    handleSimulate([]);
  };

  // Fixed Costs List Management
  const fixedCostsList = useMemo(() => {
    if (Array.isArray(profile.fixedCosts)) {
      return profile.fixedCosts.map((fc, i) =>
        typeof fc === 'number' ? { name: `Fixed cost ${i + 1}`, amount: fc } : fc
      );
    }
    return [{ name: 'Fixed Outflow', amount: Number(profile.fixedCosts) || 0 }];
  }, [profile.fixedCosts]);

  const handleUpdateFixedCost = (index, field, value) => {
    const updated = [...fixedCostsList];
    updated[index] = {
      ...updated[index],
      [field]: field === 'amount' ? (Number(value) || 0) : value
    };
    const nextProf = { ...profile, fixedCosts: updated };
    setProfile(nextProf);
    triggerSimulation(categoryCuts, rentDelta, nextProf);
  };

  const handleAddFixedCost = () => {
    const updated = [...fixedCostsList, { name: 'New bill', amount: 1500 }];
    const nextProf = { ...profile, fixedCosts: updated };
    setProfile(nextProf);
    triggerSimulation(categoryCuts, rentDelta, nextProf);
  };

  const handleDeleteFixedCost = (index) => {
    const updated = fixedCostsList.filter((_, i) => i !== index);
    const nextProf = { ...profile, fixedCosts: updated };
    setProfile(nextProf);
    triggerSimulation(categoryCuts, rentDelta, nextProf);
  };

  // Projection Chart Data Transformation
  const chartData = useMemo(() => {
    if (!projection?.months) return [];
    return projection.months.map((m, idx) => ({
      month: m,
      Continue: projection.continueSeries?.[idx] ?? 0,
      Plan: projection.planSeries?.[idx] ?? 0,
      WhatIf: projection.whatIfSeries ? (projection.whatIfSeries[idx] ?? 0) : null
    }));
  }, [projection]);

  // Calculate exact delta in months between carry-on date and what-if date
  const soonerMonths = useMemo(() => {
    const continueStr = projection?.goalDateContinue;
    const whatIfStr = projection?.goalDateWhatIf;
    if (!continueStr || !whatIfStr) return 0;
    if (continueStr === whatIfStr) return 0;

    const dContinue = new Date(continueStr);
    const dWhatIf = new Date(whatIfStr);
    if (isNaN(dContinue.getTime()) || isNaN(dWhatIf.getTime())) return 0;

    const diff = (dContinue.getFullYear() - dWhatIf.getFullYear()) * 12 + (dContinue.getMonth() - dWhatIf.getMonth());
    return diff;
  }, [projection?.goalDateContinue, projection?.goalDateWhatIf]);

  const targetAmount = Number(goal?.targetAmount) || 500000;
  const topCats = projection?.topCategories || [];

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* Editorial Headline */}
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[28px] font-normal text-ink leading-tight">
          The Course.
        </h2>
        <p className="text-[14px] text-muted">
          Set your goals and test what-ifs. Plain arithmetic moves the target arrival date as you adjust.
        </p>
      </div>

      {/* Top: Nudge Alert Cards in Grid */}
      {nudges && nudges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {nudges.map((nudge) => {
            const isWarning = nudge.type === 'warning';
            return (
              <div
                key={nudge.id}
                className={`p-3.5 rounded-card border flex items-start justify-between gap-3 ${
                  isWarning ? 'bg-accent-tint/50 border-accent-saffron/30' : 'bg-primary-tint/50 border-primary/20'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {isWarning ? (
                    <TrendingUp className="w-4 h-4 text-accent-saffron shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-[13px] font-semibold text-ink leading-tight">
                      {isWarning ? `${nudge.category} pacing ahead` : 'On track this month'}
                    </h4>
                    <p className="text-[12px] text-muted mt-0.5 leading-snug">
                      {nudge.message}
                    </p>
                  </div>
                </div>

                {/* "Why?" Popover showing numbers */}
                <Popover
                  align="right"
                  trigger={
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer"
                    >
                      <span>Why?</span>
                      <HelpCircle className="w-3 h-3" />
                    </button>
                  }
                >
                  {() => (
                    <div className="p-2 w-64 text-[12px] text-ink space-y-1">
                      <span className="font-semibold block text-primary">Calculation breakdown</span>
                      <p className="text-muted leading-tight">
                        {isWarning
                          ? `Projected overspend of ${formatRupees(nudge.projectedOverspend)} by month-end delays the goal by ~${nudge.slipDays} days at your monthly disposable net.`
                          : "Your category spending across the month remains within the expected daily linear pace."}
                      </p>
                    </div>
                  )}
                </Popover>
              </div>
            );
          })}
        </div>
      )}

      {/* Two Column Layout: Left (Your Numbers) & Right (The Projection) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Your Numbers (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Group 1: Income & Fixed Costs */}
          <Card>
            <CardHeader
              title="Income & fixed costs"
              subtitle="Monthly recurring inflows and bills"
            />

            <div className="space-y-4">
              <Input
                label="Monthly net income"
                prefix="₹"
                type="number"
                stepper
                step={5000}
                value={profile.monthlyIncome}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  const nextProf = { ...profile, monthlyIncome: val };
                  setProfile(nextProf);
                  triggerSimulation(categoryCuts, rentDelta, nextProf);
                }}
                helper="Take-home pay after taxes and deductions"
              />

              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink">Fixed costs &amp; rent</span>
                  <button
                    type="button"
                    onClick={handleAddFixedCost}
                    className="text-[12px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add cost</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {fixedCostsList.map((fc, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fc.name}
                        onChange={(e) => handleUpdateFixedCost(idx, 'name', e.target.value)}
                        placeholder="Cost name"
                        className="flex-1 bg-canvas border border-border rounded-control h-8 px-2.5 text-[13px] text-ink focus:outline-none focus:border-primary"
                      />
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-[12px]">₹</span>
                        <input
                          type="number"
                          value={fc.amount || ''}
                          onChange={(e) => handleUpdateFixedCost(idx, 'amount', e.target.value)}
                          className="w-full bg-canvas border border-border rounded-control h-8 pl-6 pr-2 text-[13px] text-ink font-medium focus:outline-none focus:border-primary"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteFixedCost(idx)}
                        className="p-1.5 text-muted hover:text-danger hover:bg-danger-tint rounded-control transition-colors cursor-pointer"
                        aria-label="Delete fixed cost"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Group 2: Target Goal Settings */}
          <Card>
            <CardHeader
              title="Target milestone"
              subtitle="The corpus you are building toward"
            />

            <div className="space-y-3.5">
              <Input
                label="Goal name"
                type="text"
                value={goal.name || ''}
                onChange={(e) => setGoal({ ...goal, name: e.target.value })}
                placeholder="e.g. Emergency Corpus, Down Payment"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Target corpus"
                  prefix="₹"
                  type="number"
                  stepper
                  step={25000}
                  value={goal.targetAmount}
                  onChange={(e) => {
                    const nextGoal = { ...goal, targetAmount: Number(e.target.value) || 0 };
                    setGoal(nextGoal);
                    triggerSimulation(categoryCuts, rentDelta, profile, nextGoal);
                  }}
                />

                <Input
                  label="Target date"
                  type="date"
                  value={goal.targetDate || ''}
                  onChange={(e) => {
                    const nextGoal = { ...goal, targetDate: e.target.value };
                    setGoal(nextGoal);
                    triggerSimulation(categoryCuts, rentDelta, profile, nextGoal);
                  }}
                />
              </div>

              <Input
                label="Currently saved"
                prefix="₹"
                type="number"
                stepper
                step={10000}
                value={goal.saved}
                onChange={(e) => {
                  const nextGoal = { ...goal, saved: Number(e.target.value) || 0 };
                  setGoal(nextGoal);
                  triggerSimulation(categoryCuts, rentDelta, profile, nextGoal);
                }}
                helper="Existing corpus allocated to this goal"
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Sticky Projection Card + What-If Levers (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5 sticky top-20">
          <Card className="flex flex-col gap-4">
            {/* Result Row above the chart */}
            <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-border">
              <div>
                <span className="text-[12px] font-medium text-muted block mb-0.5">Target arrival date</span>
                <div className="flex items-center gap-2">
                  <span className="text-[20px] font-bold text-danger tabular-nums">
                    {projection?.goalDateContinue || 'Later'}
                  </span>
                  {projection?.goalDateWhatIf && (
                    <>
                      <span className="text-muted text-[14px]">→</span>
                      <span className="text-[20px] font-bold text-success tabular-nums">
                        {projection.goalDateWhatIf}
                      </span>
                      {soonerMonths > 0 ? (
                        <Badge variant="success">
                          {soonerMonths} {soonerMonths === 1 ? 'month' : 'months'} sooner
                        </Badge>
                      ) : (
                        <Badge variant="neutral">
                          No change yet
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-[12px] font-medium">
                <span className="flex items-center gap-1.5 text-accent-saffron">
                  <span className="w-2.5 h-0.5 bg-accent-saffron border-b border-dashed" /> If you carry on
                </span>
                <span className="flex items-center gap-1.5 text-success">
                  <span className="w-2.5 h-1 bg-success rounded-full" /> Plan
                </span>
                {projection?.whatIfSeries && (
                  <span className="flex items-center gap-1.5 text-ink">
                    <span className="w-2.5 h-1 bg-ink rounded-full" /> What-if
                  </span>
                )}
              </div>
            </div>

            {/* Recharts Area/Line Chart with Subtle Area Fills */}
            <div className="w-full h-64 my-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="planGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B7F5C" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1B7F5C" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    stroke="#8A948E"
                    fontSize={11}
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
                  <ReferenceLine
                    y={targetAmount}
                    stroke="#8A948E"
                    strokeDasharray="3 3"
                    label={{
                      value: `Target: ₹${Math.round(targetAmount / 1000)}k`,
                      position: 'insideTopRight',
                      fill: '#5E6B64',
                      fontSize: 11
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Plan"
                    stroke="#1B7F5C"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#planGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="Continue"
                    stroke="#E8890C"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  {projection?.whatIfSeries && (
                    <Line
                      type="monotone"
                      dataKey="WhatIf"
                      stroke="#14201B"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Widest Gap Annotation */}
            {projection?.topOverspend && (
              <div className="p-2.5 bg-canvas rounded-control text-[12px] text-muted flex items-center justify-between">
                <span>↳ Widest gap is driven by {projection.topOverspend.category} (+{formatRupees(projection.topOverspend.rupeeGap)} above baseline).</span>
                <span className="font-semibold text-accent-saffron">Trim to close</span>
              </div>
            )}
          </Card>

          {/* What-If Levers Card */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[16px] text-ink">What-if levers</h3>
                <p className="text-[12px] text-muted">Test how small adjustments accelerate your goal</p>
              </div>
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={handleResetAdjustments}>
                Reset
              </Button>
            </div>

            {/* Presets Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-muted">Presets:</span>
              <button
                type="button"
                onClick={handlePresetCutDelivery}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border transition-colors cursor-pointer text-ink"
              >
                <Pizza className="w-3.5 h-3.5 text-accent-saffron" />
                <span>Cut food delivery 30%</span>
              </button>

              <button
                type="button"
                onClick={handlePresetRentUp}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border transition-colors cursor-pointer text-ink"
              >
                <HomeIcon className="w-3.5 h-3.5 text-[#8C5A3C]" />
                <span>Rent +₹3,000</span>
              </button>

              <button
                type="button"
                onClick={handlePresetSkipSub}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border transition-colors cursor-pointer text-ink"
              >
                <Repeat className="w-3.5 h-3.5 text-[#7A4FB0]" />
                <span>Skip a subscription</span>
              </button>
            </div>

            {/* Custom Sliders for Top 4 Variable Categories */}
            <div className="space-y-3 pt-2 border-t border-border">
              {topCats.map(({ category, monthlyAvg }) => {
                const currentVal = categoryCuts[category] || 0;
                const monthlyDelta = Math.round(monthlyAvg * (currentVal / 100));

                return (
                  <div key={category} className="p-3 bg-canvas/60 rounded-control border border-border flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-ink">{category}</span>
                      <div className="flex items-center gap-2 tabular-nums">
                        {currentVal !== 0 && (
                          <span className={`text-[12px] font-semibold ${currentVal < 0 ? 'text-success' : 'text-danger'}`}>
                            {currentVal < 0 ? `saves ${formatRupees(Math.abs(monthlyDelta))} / mo` : `costs ${formatRupees(monthlyDelta)} / mo`}
                          </span>
                        )}
                        <span className="font-mono font-medium text-muted">
                          {currentVal > 0 ? `+${currentVal}%` : `${currentVal}%`}
                        </span>
                      </div>
                    </div>

                    <Slider
                      min={-50}
                      max={50}
                      step={5}
                      value={currentVal}
                      onChange={(val) => handleSliderChange(category, val)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Rent Stepper (-₹500 / +₹500) */}
            <div className="p-3 bg-canvas/60 rounded-control border border-border flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">Rent adjustment (₹500 steps)</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleRentStep(-500)}>
                  -₹500
                </Button>
                <span className="w-20 text-center font-semibold tabular-nums text-[13px]">
                  {rentDelta > 0 ? `+₹${rentDelta}` : rentDelta < 0 ? `-₹${Math.abs(rentDelta)}` : '₹0'}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleRentStep(500)}>
                  +₹500
                </Button>
              </div>
            </div>

            {/* Bottom Action: Proceed to Future You */}
            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                icon={Sparkles}
                onClick={() => setActiveTab('letter')}
              >
                Hear testimony from Future You
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
