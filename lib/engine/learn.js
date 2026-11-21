/**
 * @file lib/engine/learn.js
 * Rule derivation and retroactive rule application.
 */

const crypto = require('crypto');

/**
 * Derive a user categorization rule from a corrected transaction.
 * @param {import('../types').Transaction} transaction
 * @param {string} category
 * @returns {import('../types').Rule}
 */
function deriveRule(transaction, category) {
  const merchantKey = (transaction.merchantKey || '').toUpperCase().trim();
  const ruleId = 'rule_' + crypto.createHash('md5').update(`${merchantKey}:${category}`).digest('hex').slice(0, 8);

  return {
    id: ruleId,
    merchantKey,
    category,
    matchType: 'exact',
    hits: 0,
    createdAt: new Date().toISOString()
  };
}

/**
 * Apply a rule across all transactions.
 * Updates ALL transactions with the same merchantKey that are not categorySource "user",
 * marks them "rule", increments rule.hits, and marks the edited transaction "user".
 * @param {import('../types').Rule} rule
 * @param {import('../types').Transaction[]} transactions
 * @param {string} [editedTxnId] - ID of the transaction the user directly edited
 * @returns {{ rule: import('../types').Rule, transactions: import('../types').Transaction[], affectedCount: number }}
 */
function applyRule(rule, transactions, editedTxnId = null) {
  if (!rule || !Array.isArray(transactions)) {
    return { rule, transactions: transactions || [], affectedCount: 0 };
  }

  const targetKey = (rule.merchantKey || '').toUpperCase().trim();
  let affectedCount = 0;

  const updatedTransactions = transactions.map(txn => {
    const isTargetMerchant = (txn.merchantKey || '').toUpperCase().trim() === targetKey;
    const isEditedTxn = editedTxnId && txn.id === editedTxnId;

    if (isEditedTxn) {
      // User directly changed this transaction
      return {
        ...txn,
        category: rule.category,
        categorySource: 'user'
      };
    }

    if (isTargetMerchant) {
      // Only overwrite if it wasn't explicitly user-set
      if (txn.categorySource !== 'user') {
        affectedCount++;
        return {
          ...txn,
          category: rule.category,
          categorySource: 'rule'
        };
      }
    }

    return txn;
  });

  const updatedRule = {
    ...rule,
    hits: (rule.hits || 0) + affectedCount
  };

  return {
    rule: updatedRule,
    transactions: updatedTransactions,
    affectedCount
  };
}

module.exports = {
  deriveRule,
  applyRule
};
