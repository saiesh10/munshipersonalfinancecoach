const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { simulate } = require('../lib/engine/simulate');
const { SAMPLE_PROFILE, SAMPLE_GOAL, SAMPLE_TRANSACTIONS } = require('../lib/mock/sampleData');

describe('Simulate Engine', () => {
  test('No NaN with empty data or missing parameters', () => {
    const emptyProj = simulate({
      profile: {},
      goal: {},
      transactions: [],
      adjustments: []
    });

    assert.ok(emptyProj, 'Projection should exist');
    assert.equal(isNaN(emptyProj.monthlyIncome), false, 'monthlyIncome should not be NaN');
    assert.equal(isNaN(emptyProj.monthlyFixed), false, 'monthlyFixed should not be NaN');
    assert.equal(isNaN(emptyProj.monthlyVariable), false, 'monthlyVariable should not be NaN');
    assert.equal(isNaN(emptyProj.monthlyNet), false, 'monthlyNet should not be NaN');
    assert.equal(isNaN(emptyProj.shortfallAtTarget), false, 'shortfallAtTarget should not be NaN');

    for (const val of emptyProj.continueSeries) {
      assert.equal(isNaN(val), false, 'continueSeries values should not be NaN');
    }
    for (const val of emptyProj.planSeries) {
      assert.equal(isNaN(val), false, 'planSeries values should not be NaN');
    }
  });

  test('whatIf improves the goal date when cutting spend', () => {
    const baseline = simulate({
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      transactions: SAMPLE_TRANSACTIONS,
      adjustments: []
    });

    assert.equal(baseline.whatIfSeries, null, 'whatIfSeries should be null when no adjustments');

    const adjusted = simulate({
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      transactions: SAMPLE_TRANSACTIONS,
      adjustments: [
        {
          type: 'category_cut',
          target: 'Food & Dining',
          changePct: -0.50
        }
      ]
    });

    assert.ok(Array.isArray(adjusted.whatIfSeries), 'whatIfSeries should be an array');
    assert.ok(adjusted.whatIfNet > baseline.monthlyNet, 'whatIfNet should be higher than baseline monthlyNet');

    // Compare continue series vs whatIf series at same month
    const lastIdx = adjusted.continueSeries.length - 1;
    assert.ok(adjusted.whatIfSeries[lastIdx] >= adjusted.continueSeries[lastIdx], 'Adjusted savings should exceed baseline');
  });

  test('Bug 2: topOverspend ignores Income, Rent, Transfers, Subscriptions and requires gap >= ₹500', () => {
    // 1. In sample data, Subscriptions has high spend (Netflix, Hotstar, Swiggy One)
    // topOverspend must NOT be Subscriptions
    const proj = simulate({
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      transactions: SAMPLE_TRANSACTIONS,
      today: '2026-11-20'
    });

    if (proj.topOverspend) {
      assert.notEqual(proj.topOverspend.category, 'Subscriptions', 'Subscriptions must be ignored from topOverspend');
      assert.notEqual(proj.topOverspend.category, 'Income', 'Income must be ignored from topOverspend');
      assert.notEqual(proj.topOverspend.category, 'Housing & Rent', 'Rent must be ignored from topOverspend');
      assert.notEqual(proj.topOverspend.category, 'Transfers', 'Transfers must be ignored from topOverspend');
      assert.ok(proj.topOverspend.rupeeGap >= 500, 'Rupee gap must be at least ₹500');
    }

    // 2. Test gap under ₹500 returns null
    const txnsLowGap = [
      { id: '1', date: '2026-10-15', amount: 3000, direction: 'debit', category: 'Food & Dining', merchant: 'Swiggy' },
      // Current month spend is 3200 (gap is only 200, which is < 500)
      { id: '2', date: '2026-11-15', amount: 3200, direction: 'debit', category: 'Food & Dining', merchant: 'Swiggy' }
    ];

    const projLow = simulate({
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      transactions: txnsLowGap,
      today: '2026-11-30'
    });

    assert.equal(projLow.topOverspend, null, 'Gap under ₹500 must return null');

    // 3. Test gap >= ₹500 returns valid topOverspend
    const txnsHighGap = [
      { id: '1', date: '2026-10-15', amount: 3000, direction: 'debit', category: 'Food & Dining', merchant: 'Swiggy' },
      // Current month spend is 5000 (gap is 2000, which is >= 500)
      { id: '2', date: '2026-11-15', amount: 5000, direction: 'debit', category: 'Food & Dining', merchant: 'Swiggy' }
    ];

    const projHigh = simulate({
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      transactions: txnsHighGap,
      today: '2026-11-30'
    });

    assert.ok(projHigh.topOverspend, 'Gap >= ₹500 must return topOverspend object');
    assert.equal(projHigh.topOverspend.category, 'Food & Dining');
    assert.equal(projHigh.topOverspend.rupeeGap, 2000);

    // 4. Test that detectDrift uses this exact same value
    const { detectDrift } = require('../lib/engine/drift');
    const nudges = detectDrift({
      transactions: txnsHighGap,
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      today: '2026-11-30'
    });

    assert.ok(nudges.length > 0, 'Should have nudges');
    const warningNudge = nudges.find(n => n.type === 'warning');
    assert.ok(warningNudge, 'Should have a warning nudge');
    assert.equal(warningNudge.category, projHigh.topOverspend.category, 'Nudge category must match topOverspend category');
    assert.equal(warningNudge.projectedOverspend, projHigh.topOverspend.rupeeGap, 'Nudge overspend must match topOverspend rupeeGap');
  });
});
