const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { categorizeTransaction, categorizeBatch } = require('../lib/engine/categorizer');

describe('Categorizer', () => {
  test('User rules beat keywords', () => {
    const txn = {
      id: 'tx_1',
      date: '2026-11-14',
      amount: 450,
      direction: 'debit',
      merchant: 'Swiggy',
      merchantKey: 'SWIGGY',
      category: 'Other',
      categorySource: 'unsure',
      rawText: 'Paid Rs 450 to SWIGGY'
    };

    // Keyword default for SWIGGY is "Food & Dining"
    const byKeyword = categorizeTransaction(txn, []);
    assert.equal(byKeyword.category, 'Food & Dining');
    assert.equal(byKeyword.categorySource, 'keyword');

    // Rule specifies "Entertainment"
    const rules = [
      { id: 'r1', merchantKey: 'SWIGGY', category: 'Entertainment', matchType: 'exact', hits: 0 }
    ];
    const byRule = categorizeTransaction(txn, rules);
    assert.equal(byRule.category, 'Entertainment');
    assert.equal(byRule.categorySource, 'rule');
  });

  test('User-set category is never overwritten', () => {
    const txn = {
      id: 'tx_2',
      date: '2026-11-14',
      amount: 450,
      direction: 'debit',
      merchant: 'Swiggy',
      merchantKey: 'SWIGGY',
      category: 'Custom Category',
      categorySource: 'user',
      rawText: 'Paid Rs 450 to SWIGGY'
    };

    const rules = [
      { id: 'r1', merchantKey: 'SWIGGY', category: 'Entertainment', matchType: 'exact', hits: 0 }
    ];

    const res = categorizeTransaction(txn, rules);
    assert.equal(res.category, 'Custom Category');
    assert.equal(res.categorySource, 'user');
  });
});
