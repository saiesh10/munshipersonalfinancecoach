/**
 * @file lib/engine/drift.js
 * Mid-month pacing and savings drift detection engine.
 * Emits actionable nudges when category spending outpaces monthly baselines.
 */

const { simulate } = require('./simulate');

/**
 * Detect mid-month spend pacing drift and generate proactive nudges.
 * @param {Object} params
 * @param {import('../types').Transaction[]} params.transactions
 * @param {import('../types').Profile} params.profile
 * @param {import('../types').Goal} params.goal
 * @param {string | Date} [params.today=new Date()]
 * @returns {import('../types').Nudge[]}
 */
function detectDrift({ transactions = [], profile = {}, goal = {}, today = new Date() }) {
  const currentDate = today instanceof Date ? today : new Date(today);

  // Run simulation to get baseline monthly averages, monthlyNet, and topOverspend
  const sim = simulate({ profile, goal, transactions, today: currentDate });
  const monthlyNet = Math.max(1, sim.monthlyNet || 1);

  // The nudges, the letter, the Ask answers and the chart annotation all use sim.topOverspend
  if (sim.topOverspend) {
    const cat = sim.topOverspend.category;
    const gap = sim.topOverspend.rupeeGap;
    const slipDays = Math.round(gap / Math.max(1, monthlyNet / 30));
    const slipWeeks = Math.max(1, Math.round(slipDays / 7));
    const pctAhead = sim.topOverspend.monthlyAvg > 0
      ? Math.round((gap / sim.topOverspend.monthlyAvg) * 100)
      : 20;

    return [
      {
        id: `drift_${cat.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        category: cat,
        type: 'warning',
        message: `${cat} is ${pctAhead}% ahead of your usual pace. At this rate the goal slips about ${slipWeeks} ${slipWeeks === 1 ? 'week' : 'weeks'}.`,
        slipDays,
        projectedOverspend: gap
      }
    ];
  }

  return [
    {
      id: 'drift_on_pace',
      category: 'All',
      type: 'positive',
      message: "You're on pace this month. Nothing to fix.",
      slipDays: 0,
      projectedOverspend: 0
    }
  ];
}

module.exports = {
  detectDrift
};
