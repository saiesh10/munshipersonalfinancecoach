const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { detectRecurring } = require('../lib/engine/recurring');
const { SAMPLE_TRANSACTIONS } = require('../lib/mock/sampleData');

describe('Recurring Engine', () => {
  test('Detects monthly Netflix, price-up Hotstar, and unused Swiggy One on sample data', () => {
    const subscriptions = detectRecurring(SAMPLE_TRANSACTIONS);
    assert.ok(subscriptions.length >= 3, 'Should detect at least Netflix, Hotstar, and Swiggy One');

    // 1. Netflix check: monthly cadence
    const netflix = subscriptions.find(s => s.merchantKey === 'NETFLIX');
    assert.ok(netflix, 'Netflix subscription should be detected');
    assert.equal(netflix.cadence, 'monthly');
    assert.equal(netflix.amount, 499);
    assert.equal(netflix.annualCost, 499 * 12);

    // 2. Hotstar check: price_up flag (from 149 to 299)
    const hotstar = subscriptions.find(s => s.merchantKey === 'HOTSTAR');
    assert.ok(hotstar, 'Hotstar subscription should be detected');
    assert.ok(hotstar.flags.includes('price_up'), 'Hotstar should have price_up flag');

    // 3. Swiggy One check: unused flag (companion Swiggy has <= 1 order in 90 days)
    const swiggyOne = subscriptions.find(s => s.merchantKey === 'SWIGGY ONE');
    assert.ok(swiggyOne, 'Swiggy One membership should be detected');
    assert.ok(swiggyOne.flags.includes('unused'), 'Swiggy One should have unused flag');

    // 4. Overlap check: Netflix and Hotstar are both video services
    assert.ok(netflix.flags.includes('overlap'), 'Netflix should be flagged with overlap');
    assert.ok(hotstar.flags.includes('overlap'), 'Hotstar should be flagged with overlap');
  });

  test('Bug 1: Groceries, Food & delivery, Transport, Shopping, Rent, Transfers, Bills do not appear as subscriptions unless in known-subscription list', () => {
    // Construct sample data with repeat monthly grocery, transport, shopping, rent, and utility charges
    const augmentedSample = [
      ...SAMPLE_TRANSACTIONS,
      // Repeat grocery charges across months
      { id: 'g1', date: '2026-09-15', amount: 1450, direction: 'debit', merchant: 'Natures Basket', merchantKey: 'NATURES BASKET', category: 'Groceries' },
      { id: 'g2', date: '2026-10-15', amount: 1450, direction: 'debit', merchant: 'Natures Basket', merchantKey: 'NATURES BASKET', category: 'Groceries' },
      // Repeat food delivery orders
      { id: 'f1', date: '2026-09-14', amount: 340, direction: 'debit', merchant: 'Swiggy', merchantKey: 'SWIGGY', category: 'Food & Dining' },
      { id: 'f2', date: '2026-10-14', amount: 340, direction: 'debit', merchant: 'Swiggy', merchantKey: 'SWIGGY', category: 'Food & Dining' },
      // Repeat transport rides
      { id: 'u1', date: '2026-09-10', amount: 450, direction: 'debit', merchant: 'Uber', merchantKey: 'UBER', category: 'Transportation' },
      { id: 'u2', date: '2026-10-10', amount: 450, direction: 'debit', merchant: 'Uber', merchantKey: 'UBER', category: 'Transportation' },
      { id: 'u3', date: '2026-11-10', amount: 450, direction: 'debit', merchant: 'Uber', merchantKey: 'UBER', category: 'Transportation' },
      // Repeat rent
      { id: 'r1', date: '2026-09-01', amount: 28000, direction: 'debit', merchant: 'Landlord', merchantKey: 'LANDLORD', category: 'Housing & Rent' },
      { id: 'r2', date: '2026-10-01', amount: 28000, direction: 'debit', merchant: 'Landlord', merchantKey: 'LANDLORD', category: 'Housing & Rent' },
      // Repeat electricity bill
      { id: 'b1', date: '2026-09-05', amount: 2400, direction: 'debit', merchant: 'Bescom Electricity', merchantKey: 'BESCOM', category: 'Bills & Utilities' },
      { id: 'b2', date: '2026-10-05', amount: 2400, direction: 'debit', merchant: 'Bescom Electricity', merchantKey: 'BESCOM', category: 'Bills & Utilities' }
    ];

    const subscriptions = detectRecurring(augmentedSample);

    // None of these restricted merchants should appear as subscriptions
    const subKeys = subscriptions.map(s => s.merchantKey);
    assert.equal(subKeys.includes('NATURES BASKET'), false, 'Groceries should not appear as subscription');
    assert.equal(subKeys.includes('SWIGGY'), false, 'Food & delivery merchant SWIGGY should not appear as subscription');
    assert.equal(subKeys.includes('UBER'), false, 'Transport merchant UBER should not appear as subscription');
    assert.equal(subKeys.includes('LANDLORD'), false, 'Rent merchant should not appear as subscription');
    assert.equal(subKeys.includes('BESCOM'), false, 'Utility bill should not appear as subscription');

    // Only known subscriptions should appear
    assert.ok(subKeys.includes('NETFLIX'), 'Netflix must be detected');
    assert.ok(subKeys.includes('HOTSTAR'), 'Hotstar must be detected');
    assert.ok(subKeys.includes('SWIGGY ONE'), 'Swiggy One must be detected');
  });

  test('Bug 1: SWIGGY ONE is treated as a separate merchantKey from SWIGGY and price flags never mix them', () => {
    const { normalizeMerchant } = require('../lib/engine/parser');

    // Test parser normalization separation
    const swiggyFood = normalizeMerchant('SWIGGY');
    const swiggyFoodOrder = normalizeMerchant('SWIGGY ORDER');
    const swiggyOne = normalizeMerchant('SWIGGY ONE MEMBERSHIP');

    assert.equal(swiggyFood.merchantKey, 'SWIGGY', 'Food order merchantKey must be SWIGGY');
    assert.equal(swiggyFoodOrder.merchantKey, 'SWIGGY', 'Food order merchantKey must be SWIGGY');
    assert.equal(swiggyOne.merchantKey, 'SWIGGY ONE', 'Membership merchantKey must be SWIGGY ONE');
    assert.notEqual(swiggyFood.merchantKey, swiggyOne.merchantKey, 'SWIGGY ONE and SWIGGY must never share the same merchantKey');

    // Test that Swiggy One detection on sample data does not mix with food orders
    const subscriptions = detectRecurring(SAMPLE_TRANSACTIONS);
    const subSwiggyOne = subscriptions.find(s => s.merchantKey === 'SWIGGY ONE');

    assert.ok(subSwiggyOne, 'SWIGGY ONE subscription must be found');
    assert.equal(subSwiggyOne.amount, 1499, 'SWIGGY ONE amount must be 1499 (not food order 340)');
    // Price up flag should NOT be present on Swiggy One since both Oct and Nov were 1499
    assert.equal(subSwiggyOne.flags.includes('price_up'), false, 'SWIGGY ONE should not have price_up flag from food order amounts');
  });
});
