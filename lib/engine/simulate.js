/**
 * @file lib/engine/simulate.js
 * Deterministic financial projection simulator.
 * Computes baseline savings rate, plan trajectories, what-if scenarios, and overspend leaks.
 */

/**
 * Format Date to "Mon YYYY" (e.g. "Dec 2026")
 * @param {Date} d
 * @returns {string}
 */
function formatMonthYear(d) {
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Parse YYYY-MM-DD or return fallback date.
 * @param {string} dateStr
 * @returns {Date}
 */
function safeDate(dateStr) {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Pure simulation engine.
 * @param {Object} params
 * @param {import('../types').Profile} params.profile
 * @param {import('../types').Goal} params.goal
 * @param {import('../types').Transaction[]} [params.transactions=[]]
 * @param {import('../types').Adjustment[]} [params.adjustments=[]]
 * @param {string | Date} [params.today=new Date()]
 * @returns {import('../types').Projection}
 */
function simulate({ profile = {}, goal = {}, transactions = [], adjustments = [], today = new Date() }) {
  const currentDate = today instanceof Date ? today : safeDate(today);
  const targetDate = safeDate(goal.targetDate);

  const monthlyIncome = Math.max(0, Number(profile.monthlyIncome) || 0);

  // Sum profile fixed costs (handles array of numbers, array of objects, or single number)
  let fixedCostsSum = 0;
  if (Array.isArray(profile.fixedCosts)) {
    fixedCostsSum = profile.fixedCosts.reduce((acc, item) => {
      if (typeof item === 'number') return acc + item;
      if (item && typeof item.amount === 'number') return acc + item.amount;
      return acc;
    }, 0);
  } else if (typeof profile.fixedCosts === 'number') {
    fixedCostsSum = profile.fixedCosts;
  }
  fixedCostsSum = Math.max(0, fixedCostsSum);

  const targetAmount = Math.max(0, Number(goal.targetAmount) || 0);
  const saved = Math.max(0, Number(goal.saved) || 0);

  // Helper to exclude non-variable categories (Income, Rent, Transfers, Subscriptions)
  function isExcludedCategory(cat = '') {
    const c = (cat || '').toLowerCase().trim();
    return (
      c.includes('income') ||
      c.includes('rent') ||
      c.includes('housing') ||
      c.includes('transfer') ||
      c.includes('investment') ||
      c.includes('subscription')
    );
  }

  // 1. Filter debit transactions and exclude non-variable categories
  const debitTxns = (Array.isArray(transactions) ? transactions : []).filter(t => 
    t && t.direction === 'debit' && !isExcludedCategory(t.category)
  );

  // Group transactions by "YYYY-MM" and by category
  const monthCategorySpend = {}; // { '2026-10': { 'Food & Dining': 12000, ... } }
  const allMonthsSet = new Set();

  for (const txn of debitTxns) {
    if (!txn.date || !txn.amount) continue;
    const yyyyMm = txn.date.slice(0, 7);
    allMonthsSet.add(yyyyMm);

    if (!monthCategorySpend[yyyyMm]) {
      monthCategorySpend[yyyyMm] = {};
    }
    const cat = txn.category || 'Other';
    monthCategorySpend[yyyyMm][cat] = (monthCategorySpend[yyyyMm][cat] || 0) + txn.amount;
  }

  // Determine months to consider (last 3 calendar months, or available)
  const sortedMonths = Array.from(allMonthsSet).sort();
  const baselineMonths = sortedMonths.slice(-3); // Last 3 available months
  const numMonths = Math.max(1, baselineMonths.length);

  // Calculate average monthly spend per category across baseline months
  const categoryTotals = {};
  for (const m of baselineMonths) {
    const spendInMonth = monthCategorySpend[m] || {};
    for (const [cat, amt] of Object.entries(spendInMonth)) {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  }

  const categoryAverages = {};
  let monthlyVariable = 0;
  for (const [cat, total] of Object.entries(categoryTotals)) {
    const avg = Math.round(total / numMonths);
    categoryAverages[cat] = avg;
    monthlyVariable += avg;
  }

  const monthlyNet = Math.round(monthlyIncome - fixedCostsSum - monthlyVariable);

  // Top 4 variable categories for UI sliders
  const topCategories = Object.entries(categoryAverages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category, monthlyAvg]) => ({ category, monthlyAvg }));

  // 2. Identify top overspend:
  // Per category, compare latest full month (or month-to-date pace) with 3-month baseline in rupees.
  // Ignore Income, Rent, Transfers and Subscriptions. Require a gap of at least ₹500, else return null.
  let topOverspend = null;

  if (sortedMonths.length > 0) {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-indexed
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const dayOfMonth = Math.max(1, currentDate.getDate());
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const latestMonth = sortedMonths[sortedMonths.length - 1];
    const isOngoingCurrentMonth = latestMonth === currentMonthPrefix && dayOfMonth < daysInMonth;

    // Up to 3 prior baseline months before the latest month
    const priorMonths = sortedMonths.filter(m => m < latestMonth).slice(-3);
    const priorCount = priorMonths.length;

    if (priorCount > 0) {
      const baselineAverages = {};
      for (const m of priorMonths) {
        const spendInMonth = monthCategorySpend[m] || {};
        for (const [cat, amt] of Object.entries(spendInMonth)) {
          baselineAverages[cat] = (baselineAverages[cat] || 0) + amt;
        }
      }
      for (const [cat, total] of Object.entries(baselineAverages)) {
        baselineAverages[cat] = Math.round(total / priorCount);
      }

      const latestSpend = monthCategorySpend[latestMonth] || {};
      let maxGap = 0;
      let maxCategory = null;

      for (const [cat, amt] of Object.entries(latestSpend)) {
        if (isExcludedCategory(cat)) continue;

        // Projected month spend based on month-to-date pacing if ongoing, else full month spend
        const paceSpend = isOngoingCurrentMonth
          ? Math.round((amt / dayOfMonth) * daysInMonth)
          : amt;

        const base = baselineAverages[cat] || 0;
        const gap = paceSpend - base;

        if (gap > maxGap) {
          maxGap = gap;
          maxCategory = cat;
        }
      }

      // Require a gap of at least ₹500, else return null
      if (maxCategory && maxGap >= 500) {
        topOverspend = {
          category: maxCategory,
          rupeeGap: Math.round(maxGap),
          monthlyAvg: baselineAverages[maxCategory] || 0,
          share: 0 // Will compute after shortfall
        };
      }
    }
  }

  // 3. Build Months Axis: from next month up to 2 months after targetDate (max 36 months)
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  // Calculate number of months between next month and target date
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const rawMonthsToTarget = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
  const monthsToTarget = Math.max(1, rawMonthsToTarget);

  const horizonMonthsCount = Math.min(36, Math.max(6, monthsToTarget + 2));

  const months = [];
  const planSeries = [];
  const continueSeries = [];

  let goalDateContinue = null;
  let targetIdx = Math.min(monthsToTarget - 1, horizonMonthsCount - 1);
  if (targetIdx < 0) targetIdx = 0;

  for (let m = 1; m <= horizonMonthsCount; m++) {
    const pointDate = new Date(currentYear, currentMonth + m, 1);
    months.push(formatMonthYear(pointDate));

    // continue[m] = goal.saved + monthlyNet * m (never below 0)
    const contVal = Math.max(0, saved + (monthlyNet * m));
    continueSeries.push(contVal);

    if (goalDateContinue === null && contVal >= targetAmount) {
      goalDateContinue = formatMonthYear(pointDate);
    }

    // plan[m]: linear from goal.saved to goal.targetAmount at targetIdx (target date)
    let planVal = 0;
    if (m <= (targetIdx + 1)) {
      const progress = m / (targetIdx + 1);
      planVal = Math.round(saved + (targetAmount - saved) * progress);
    } else {
      planVal = targetAmount;
    }
    planSeries.push(planVal);
  }

  // Shortfall at target date
  const continueAtTarget = continueSeries[targetIdx] !== undefined ? continueSeries[targetIdx] : (saved + monthlyNet * (targetIdx + 1));
  const shortfallAtTarget = Math.max(0, targetAmount - continueAtTarget);

  // Top overspend share
  if (topOverspend) {
    const monthlyShortfall = shortfallAtTarget / Math.max(1, targetIdx + 1);
    const share = monthlyShortfall > 0 ? Math.min(1, Math.max(0, topOverspend.rupeeGap / monthlyShortfall)) : 0;
    topOverspend.share = Number(share.toFixed(2));
  }

  // Cut percentage needed on topOverspend category
  let cutPctNeeded = null;
  if (shortfallAtTarget > 0 && topOverspend && topOverspend.monthlyAvg > 0) {
    const monthlyNeeded = shortfallAtTarget / Math.max(1, targetIdx + 1);
    const fraction = monthlyNeeded / topOverspend.monthlyAvg;
    cutPctNeeded = fraction <= 1 ? Math.round(fraction * 100) : 100;
  }

  // 4. What-If series (if adjustments exist)
  let whatIfSeries = null;
  let whatIfNet = null;
  let goalDateWhatIf = null;

  if (Array.isArray(adjustments) && adjustments.length > 0) {
    const adjustedCategories = { ...categoryAverages };
    let adjustedFixed = fixedCostsSum;
    let subscriptionSavings = 0;

    for (const adj of adjustments) {
      if (!adj) continue;

      if (adj.type === 'category_cut') {
        const cat = adj.target;
        const changePct = Number(adj.changePct) || 0; // e.g. -0.20
        if (adjustedCategories[cat] !== undefined) {
          adjustedCategories[cat] = Math.max(0, Math.round(adjustedCategories[cat] * (1 + changePct)));
        }
      } else if (adj.type === 'rent_delta') {
        const delta = Number(adj.amount) || 0;
        adjustedFixed = Math.max(0, adjustedFixed + delta);
      } else if (adj.type === 'skip_subscription') {
        const skippedAmt = Number(adj.amount) || 0;
        subscriptionSavings += skippedAmt;
      }
    }

    const adjustedVarTotal = Object.values(adjustedCategories).reduce((s, v) => s + v, 0);
    whatIfNet = Math.round(monthlyIncome - adjustedFixed - adjustedVarTotal + subscriptionSavings);

    whatIfSeries = [];
    for (let m = 1; m <= horizonMonthsCount; m++) {
      const val = Math.max(0, saved + (whatIfNet * m));
      whatIfSeries.push(val);

      if (goalDateWhatIf === null && val >= targetAmount) {
        const pointDate = new Date(currentYear, currentMonth + m, 1);
        goalDateWhatIf = formatMonthYear(pointDate);
      }
    }
  }

  return {
    months,
    continueSeries,
    planSeries,
    whatIfSeries,
    goalDateContinue,
    goalDatePlan: formatMonthYear(targetDate),
    goalDateWhatIf,
    shortfallAtTarget,
    monthlyIncome,
    monthlyFixed: fixedCostsSum,
    monthlyVariable,
    monthlyNet,
    whatIfNet,
    topOverspend,
    topCategories,
    cutPctNeeded
  };
}

module.exports = {
  simulate,
  formatMonthYear
};
