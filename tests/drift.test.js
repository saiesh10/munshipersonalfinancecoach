const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { detectDrift } = require('../lib/engine/drift');
const { SAMPLE_PROFILE, SAMPLE_GOAL, SAMPLE_TRANSACTIONS } = require('../lib/mock/sampleData');

describe('Drift Engine', () => {
  test('Returns positive on-pace nudge when no transactions exceed baseline pacing', () => {
    // Current date set to Nov 5, 2026, with only minor spend
    const today = '2026-11-05';
    const txns = [
      {
        id: 't1',
        date: '2026-11-02',
        amount: 300,
        direction: 'debit',
        category: 'Food & Dining',
        merchant: 'Swiggy'
      }
    ];

    const nudges = detectDrift({
      transactions: txns,
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      today
    });

    assert.ok(Array.isArray(nudges), 'Nudges should be an array');
    assert.equal(nudges.length, 1, 'Should return 1 on-pace nudge');
    assert.equal(nudges[0].type, 'positive');
    assert.equal(nudges[0].message, "You're on pace this month. Nothing to fix.");
    assert.equal(nudges[0].slipDays, 0);
  });

  test('Emits warning nudge with slip days when a category outpaces expected spend', () => {
    // On day 5 of the month, Food & Dining has already spent 15,000 against a normal baseline of ~10,000
    const today = '2026-11-05';
    const txns = [
      // Baseline history from October
      { id: 'b1', date: '2026-10-05', amount: 5000, direction: 'debit', category: 'Food & Dining', merchant: 'Swiggy' },
      { id: 'b2', date: '2026-10-15', amount: 5000, direction: 'debit', category: 'Food & Dining', merchant: 'Zomato' },
      // Heavy spend early in November
      { id: 'n1', date: '2026-11-02', amount: 8000, direction: 'debit', category: 'Food & Dining', merchant: 'Swiggy' },
      { id: 'n2', date: '2026-11-04', amount: 7000, direction: 'debit', category: 'Food & Dining', merchant: 'Zomato' }
    ];

    const nudges = detectDrift({
      transactions: txns,
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      today
    });

    assert.ok(Array.isArray(nudges), 'Nudges should be an array');
    const warning = nudges.find(n => n.category === 'Food & Dining');
    assert.ok(warning, 'Should emit a warning nudge for Food & Dining');
    assert.equal(warning.type, 'warning');
    assert.ok(warning.slipDays > 0, 'slipDays should be greater than zero');
    assert.ok(warning.message.includes('ahead of your usual pace'), 'Message should describe pacing ahead');
  });
});
