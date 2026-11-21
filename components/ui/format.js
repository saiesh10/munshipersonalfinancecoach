/**
 * @file components/ui/format.js
 * Indian rupee formatting and category color palette tokens.
 */

export const CATEGORY_COLORS = {
  'Food & Dining': '#E8890C',
  'Food & delivery': '#E8890C',
  'Groceries': '#5B8C3A',
  'Transportation': '#3A6EA5',
  'Transport': '#3A6EA5',
  'Shopping': '#B04A7A',
  'Bills & Utilities': '#6B6F7A',
  'Bills & utilities': '#6B6F7A',
  'Housing & Rent': '#8C5A3C',
  'Rent': '#8C5A3C',
  'Subscriptions': '#7A4FB0',
  'Healthcare & Fitness': '#C0392B',
  'Health': '#C0392B',
  'Entertainment': '#D0A100',
  'Travel': '#1E8A8A',
  'Education': '#4A5FC1',
  'Income': '#1B7F5C',
  'Transfers': '#8A948E',
  'Other': '#A39E93',
  'General Spending': '#E8890C'
};

export const CATEGORY_TINTS = {
  'Food & Dining': '#FDF1DD',
  'Food & delivery': '#FDF1DD',
  'Groceries': '#EEF5E8',
  'Transportation': '#EBF2F9',
  'Transport': '#EBF2F9',
  'Shopping': '#F9ECF2',
  'Bills & Utilities': '#F0F1F3',
  'Bills & utilities': '#F0F1F3',
  'Housing & Rent': '#F5EFEA',
  'Rent': '#F5EFEA',
  'Subscriptions': '#F3EEF9',
  'Healthcare & Fitness': '#FBEAE7',
  'Health': '#FBEAE7',
  'Entertainment': '#FAF4DC',
  'Travel': '#E5F4F4',
  'Education': '#ECEFFB',
  'Income': '#E6F2EC',
  'Transfers': '#F1F3F2',
  'Other': '#F4F3F1',
  'General Spending': '#FDF1DD'
};

/**
 * Get category hex color with fallback.
 * @param {string} category
 * @returns {string}
 */
export function getCategoryColor(category) {
  if (!category) return CATEGORY_COLORS['Other'];
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
}

/**
 * Get category light tint with fallback.
 * @param {string} category
 * @returns {string}
 */
export function getCategoryTint(category) {
  if (!category) return CATEGORY_TINTS['Other'];
  return CATEGORY_TINTS[category] || CATEGORY_TINTS['Other'];
}

/**
 * Format number into Indian currency (₹).
 * @param {number} amount
 * @param {Object} [options]
 * @param {boolean} [options.showPlus=false] - Prepend '+' for positive credits
 * @param {boolean} [options.decimals=false] - Include 2 decimals
 * @returns {string}
 */
export function formatRupees(amount, { showPlus = false, decimals = false } = {}) {
  const num = Number(amount) || 0;
  const isPositive = num > 0;
  const absVal = Math.abs(num);

  const formatted = decimals
    ? absVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(absVal).toLocaleString('en-IN');

  if (num < 0) {
    return `-₹${formatted}`;
  }
  if (isPositive && showPlus) {
    return `+₹${formatted}`;
  }
  return `₹${formatted}`;
}
