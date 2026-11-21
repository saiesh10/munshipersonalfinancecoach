const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { deriveRule, applyRule } = require('../lib/engine/learn');

describe('Learn Engine', () => {
  test('deriveRule creates a valid exact rule', () => {
    const txn = {
      id: 'tx_swiggy_1',
      merchantKey: 'SWIGGY',
      category: 'Other',
      categorySource: 'unsure'
    };

    const rule = deriveRule(txn, 'Food & Dining');
    assert.equal(rule.merchantKey, 'SWIGGY');
    assert.equal(rule.category, 'Food & Dining');
    assert.equal(rule.matchType, 'exact');
    assert.equal(rule.hits, 0);
  });

  test('applyRule correctly computes affectedCount and updates sources', () => {
    const rule = {
      id: 'rule_swiggy',
      merchantKey: 'SWIGGY',
      category: 'Food & Dining',
      matchType: 'exact',
      hits: 0
    };

    const transactions = [
      // 1: The transaction the user manually edited
      { id: 'tx_1', merchantKey: 'SWIGGY', category: 'Other', categorySource: 'unsure' },
      // 2: An un-customized transaction for the same merchant
      { id: 'tx_2', merchantKey: 'SWIGGY', category: 'Other', categorySource: 'keyword' },
      // 3: A previously user-pinned transaction for the same merchant (should not be touched)
      { id: 'tx_3', merchantKey: 'SWIGGY', category: 'Special Food', categorySource: 'user' },
      // 4: Unrelated transaction
      { id: 'tx_4', merchantKey: 'NETFLIX', category: 'Subscriptions', categorySource: 'keyword' }
    ];

    const { rule: updatedRule, transactions: updatedTxns, affectedCount } = applyRule(rule, transactions, 'tx_1');

    assert.equal(affectedCount, 1, 'Only tx_2 should be counted as affected');
    assert.equal(updatedRule.hits, 1, 'Rule hits should increment by 1');

    const tx1 = updatedTxns.find(t => t.id === 'tx_1');
    assert.equal(tx1.category, 'Food & Dining');
    assert.equal(tx1.categorySource, 'user', 'Directly edited transaction must be categorySource "user"');

    const tx2 = updatedTxns.find(t => t.id === 'tx_2');
    assert.equal(tx2.category, 'Food & Dining');
    assert.equal(tx2.categorySource, 'rule', 'Updated same-merchant transaction must be categorySource "rule"');

    const tx3 = updatedTxns.find(t => t.id === 'tx_3');
    assert.equal(tx3.category, 'Special Food');
    assert.equal(tx3.categorySource, 'user', 'Existing user category must never be overwritten');
  });
});
