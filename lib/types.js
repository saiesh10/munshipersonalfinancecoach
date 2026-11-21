/**
 * @file lib/types.js
 * Core data models and schemas for Munshi Personal Finance Coach.
 */

/**
 * @typedef {'debit' | 'credit'} TransactionDirection
 * @typedef {'user' | 'rule' | 'keyword' | 'ai' | 'unsure'} CategorySource
 * @typedef {'weekly' | 'monthly' | 'yearly'} SubscriptionCadence
 * @typedef {'category_cut' | 'rent_delta' | 'skip_subscription'} AdjustmentType
 * @typedef {'warning' | 'positive'} NudgeType
 * @typedef {'gemini' | 'fallback'} LetterSource
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id - Stable hash of date + amount + merchantKey + rawText
 * @property {string} date - ISO date string YYYY-MM-DD
 * @property {number} amount - Rupee amount, positive
 * @property {TransactionDirection} direction - 'debit' or 'credit'
 * @property {string} merchant - Clean display name in Title Case
 * @property {string} merchantKey - UPPERCASE normalized merchant key
 * @property {string} category - Assigned category name
 * @property {CategorySource} categorySource - Origin of categorization
 * @property {string} rawText - Original SMS or CSV line
 * @property {string} [account] - Masked account / card string e.g. "XX1234"
 * @property {string} [ref] - Reference or UPI transaction ID
 */

/**
 * @typedef {Object} Rule
 * @property {string} id - Unique rule identifier
 * @property {string} merchantKey - UPPERCASE key to match
 * @property {string} category - Target category
 * @property {'exact' | 'contains'} matchType - Matching mode
 * @property {number} hits - Number of times rule applied
 * @property {string} createdAt - ISO timestamp
 */

/**
 * @typedef {Object} Profile
 * @property {number} monthlyIncome - Total monthly net income in rupees
 * @property {Array<number | { name: string, amount: number }> | number} fixedCosts - Fixed monthly costs (rent, EMI, etc.)
 * @property {string} [name] - User name or display handle
 */

/**
 * @typedef {Object} Goal
 * @property {string} id - Goal identifier
 * @property {string} name - Goal name (e.g. "Emergency Fund", "Trip to Ladakh")
 * @property {number} targetAmount - Target corpus in rupees
 * @property {string} targetDate - Target date in YYYY-MM-DD
 * @property {number} saved - Current accumulated savings
 */

/**
 * @typedef {Object} Subscription
 * @property {string} id - Subscription identifier (e.g. "sub_netflix")
 * @property {string} merchant - Clean display name
 * @property {string} merchantKey - UPPERCASE normalized merchant key
 * @property {number} amount - Latest recurring rupee amount
 * @property {SubscriptionCadence} cadence - 'weekly' | 'monthly' | 'yearly'
 * @property {number} annualCost - Normalized annual cost in rupees
 * @property {string} lastDate - Date of the latest detected charge
 * @property {string[]} flags - Active warning flags: 'price_up' | 'unused' | 'overlap'
 * @property {string} [flagMessage] - Human explanation of active flags
 */

/**
 * @typedef {Object} Adjustment
 * @property {AdjustmentType} type - 'category_cut' | 'rent_delta' | 'skip_subscription'
 * @property {string} target - Target category or subscription ID
 * @property {number} [changePct] - Fractional cut (e.g. -0.2 for 20% cut)
 * @property {number} [amount] - Absolute rupee delta or skipped monthly amount
 */

/**
 * @typedef {Object} Projection
 * @property {string[]} months - Horizon month labels e.g. ["Dec 2026", "Jan 2027"]
 * @property {number[]} continueSeries - Baseline projection series
 * @property {number[]} planSeries - Required linear savings series
 * @property {number[] | null} whatIfSeries - Adjusted projection series if adjustments provided
 * @property {string | null} goalDateContinue - Month achieved under status quo
 * @property {string} goalDatePlan - Target month
 * @property {string | null} goalDateWhatIf - Month achieved under adjustments
 * @property {number} shortfallAtTarget - Projected rupee deficit at target date
 * @property {number} monthlyIncome - Monthly income baseline
 * @property {number} monthlyFixed - Sum of monthly fixed costs
 * @property {number} monthlyVariable - Sum of monthly variable costs
 * @property {number} monthlyNet - Monthly disposable savings baseline
 * @property {number | null} whatIfNet - Adjusted monthly net savings
 * @property {{ category: string, rupeeGap: number, share: number } | null} topOverspend - Biggest leak
 * @property {Array<{ category: string, monthlyAvg: number }>} topCategories - Top 4 variable categories
 * @property {number | null} cutPctNeeded - Required cut percentage to top overspend category
 */

/**
 * @typedef {Object} Nudge
 * @property {string} id - Unique identifier
 * @property {string} category - Target category or 'All'
 * @property {NudgeType} type - 'warning' or 'positive'
 * @property {string} message - Human-readable guidance
 * @property {number} slipDays - Estimated delay in days caused by this trend
 * @property {number} projectedOverspend - Estimated month-end surplus spend
 */

/**
 * @typedef {Object} Letter
 * @property {string} text - Plain text letter content
 * @property {LetterSource} source - 'gemini' or 'fallback'
 * @property {string} generatedAt - ISO timestamp
 */

module.exports = {
  // Model validator constants
  DIRECTIONS: ['debit', 'credit'],
  CATEGORY_SOURCES: ['user', 'rule', 'keyword', 'ai', 'unsure'],
  SUBSCRIPTION_CADENCES: ['weekly', 'monthly', 'yearly'],
  ADJUSTMENT_TYPES: ['category_cut', 'rent_delta', 'skip_subscription'],
  NUDGE_TYPES: ['warning', 'positive'],
  LETTER_SOURCES: ['gemini', 'fallback']
};
