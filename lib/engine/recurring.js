/**
 * @file lib/engine/recurring.js
 * Recurring expense and subscription detection engine.
 * Classifies cadence, detects price increases, companion utilization leaks, and category overlaps.
 */

const KNOWN_SUBSCRIPTION_MERCHANTS = new Set([
  'NETFLIX',
  'HOTSTAR',
  'DISNEY+ HOTSTAR',
  'DISNEY HOTSTAR',
  'PRIME',
  'PRIME VIDEO',
  'AMAZON PRIME',
  'SPOTIFY',
  'YOUTUBE',
  'YOUTUBE PREMIUM',
  'JIOCINEMA',
  'SONY LIV',
  'SONYLIV',
  'ZEE5',
  'GAANA',
  'WYNK',
  'APPLE MUSIC',
  'APPLE TV',
  'TIMES PRIME',
  'SWIGGY ONE',
  'ZOMATO GOLD',
  'CULT.FIT',
  'CULTFIT',
  'AUDIBLE',
  'KINDLE',
  'CHATGPT',
  'OPENAI',
  'CLAUDE',
  'MEDIUM'
]);

/**
 * Check if a merchant is in the known-subscription list:
 * Netflix, Hotstar, Spotify, Swiggy One, Zomato Gold, Prime, YouTube Premium, Cult.fit, gym memberships.
 * @param {string} merchantKey
 * @param {string} [merchant='']
 * @returns {boolean}
 */
function isKnownSubscriptionMerchant(merchantKey = '', merchant = '') {
  const upperKey = (merchantKey || '').toUpperCase().trim();
  const upperName = (merchant || '').toUpperCase().trim();

  if (KNOWN_SUBSCRIPTION_MERCHANTS.has(upperKey)) return true;

  const patterns = [
    'NETFLIX',
    'HOTSTAR',
    'SPOTIFY',
    'SWIGGY ONE',
    'ZOMATO GOLD',
    'PRIME',
    'YOUTUBE PREMIUM',
    'CULT.FIT',
    'CULTFIT'
  ];

  for (const pat of patterns) {
    if (upperKey === pat || upperKey.includes(pat) || upperName.includes(pat)) {
      return true;
    }
  }

  // Check for gym memberships
  if (/\b(?:gym|fitness|workout|crossfit)\b/i.test(upperKey) || /\b(?:gym|fitness|workout|crossfit)\b/i.test(upperName)) {
    return true;
  }

  return false;
}

/**
 * Check if category is one of the restricted subscription categories:
 * Groceries, Food & delivery, Transport, Shopping, Rent, Transfers and Bills & utilities.
 * @param {string} category
 * @returns {boolean}
 */
function isRestrictedSubscriptionCategory(category = '') {
  const cat = (category || '').toLowerCase().trim();
  return (
    cat.includes('grocer') ||
    cat.includes('food') ||
    cat.includes('dining') ||
    cat.includes('delivery') ||
    cat.includes('transport') ||
    cat.includes('shopping') ||
    cat.includes('rent') ||
    cat.includes('housing') ||
    cat.includes('transfer') ||
    cat.includes('investment') ||
    cat.includes('bill') ||
    cat.includes('utilit') ||
    cat.includes('income')
  );
}

const COMPANIONS = {
  'SWIGGY ONE': 'SWIGGY',
  'ZOMATO GOLD': 'ZOMATO',
  'AMAZON PRIME': 'AMAZON',
  'PRIME': 'AMAZON',
  'UBER ONE': 'UBER'
};

const OVERLAP_GROUPS = {
  video: {
    label: 'video services',
    members: ['NETFLIX', 'HOTSTAR', 'DISNEY+ HOTSTAR', 'DISNEY HOTSTAR', 'PRIME VIDEO', 'SONY LIV', 'SONYLIV', 'JIOCINEMA', 'ZEE5', 'APPLE TV']
  },
  music: {
    label: 'music services',
    members: ['SPOTIFY', 'APPLE MUSIC', 'YOUTUBE MUSIC', 'GAANA', 'WYNK']
  }
};

/**
 * Calculate median of a number array.
 * @param {number[]} arr
 * @returns {number}
 */
function getMedian(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Month name formatter helper.
 * @param {string} dateStr
 * @returns {string}
 */
function getMonthName(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { month: 'long' });
  } catch {
    return 'recent months';
  }
}

/**
 * Detect recurring subscriptions and leaks from a list of transactions.
 * @param {import('../types').Transaction[]} transactions
 * @returns {import('../types').Subscription[]}
 */
function detectRecurring(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  // 1. Group debits by merchantKey
  const debitsByMerchant = new Map();

  for (const txn of transactions) {
    if (txn.direction !== 'debit') continue;

    const isKnownSub = isKnownSubscriptionMerchant(txn.merchantKey, txn.merchant);
    const isSubCategory = txn.category === 'Subscriptions';
    const isRestricted = isRestrictedSubscriptionCategory(txn.category);

    // Groceries, Food & delivery, Transport, Shopping, Rent, Transfers and Bills & utilities merchants
    // must NOT appear as subscriptions unless the merchant is in a known-subscription list
    if (isRestricted && !isKnownSub) {
      continue;
    }

    if (!isKnownSub && !isSubCategory && isRestricted) {
      continue;
    }

    if (!debitsByMerchant.has(txn.merchantKey)) {
      debitsByMerchant.set(txn.merchantKey, []);
    }
    debitsByMerchant.get(txn.merchantKey).push(txn);
  }

  const candidateSubscriptions = [];

  for (const [merchantKey, txns] of debitsByMerchant.entries()) {
    if (txns.length < 2) continue;

    // Sort chronologically ascending
    txns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate day gaps between consecutive charges
    const gaps = [];
    for (let i = 1; i < txns.length; i++) {
      const prevDate = new Date(txns[i - 1].date);
      const currDate = new Date(txns[i].date);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      gaps.push(diffDays);
    }

    if (gaps.length === 0) continue;

    const medianGap = getMedian(gaps);

    // Classify cadence:
    // weekly (6–8), monthly (26–35), yearly (355–375)
    let cadence = null;
    let minGap = 0;
    let maxGap = 0;

    if (medianGap >= 5 && medianGap <= 9) {
      cadence = 'weekly';
      minGap = 6;
      maxGap = 8;
    } else if (medianGap >= 25 && medianGap <= 36) {
      cadence = 'monthly';
      minGap = 26;
      maxGap = 35;
    } else if (medianGap >= 350 && medianGap <= 380) {
      cadence = 'yearly';
      minGap = 355;
      maxGap = 375;
    }

    if (!cadence) continue;

    // Require at least 70% of gaps in range
    const validGaps = gaps.filter(g => g >= minGap && g <= maxGap);
    if ((validGaps.length / gaps.length) < 0.70) {
      continue;
    }

    // Amount stability: allow ±15% of median amount or an upward price step (price_up)
    const amounts = txns.map(t => t.amount);
    const medianAmount = getMedian(amounts);
    const stableAmounts = amounts.filter(a => Math.abs(a - medianAmount) <= (medianAmount * 0.15));

    // A price increase step change between consecutive charges is recognized
    const isPriceStep = (amounts.length === 2 && amounts[1] > amounts[0]) ||
      (amounts.length > 2 && amounts[amounts.length - 1] > amounts[amounts.length - 2]);

    const isStable = (stableAmounts.length / amounts.length) >= 0.70 || isPriceStep;

    if (!isStable) {
      continue;
    }

    const latestTxn = txns[txns.length - 1];
    const prevTxn = txns[txns.length - 2];
    const latestAmount = latestTxn.amount;

    let multiplier = 12;
    if (cadence === 'weekly') multiplier = 52;
    if (cadence === 'yearly') multiplier = 1;
    const annualCost = Math.round(latestAmount * multiplier);

    const flags = [];
    const flagMessages = [];

    // Flag 1: price_up (latest differs from previous by > 2%)
    if (prevTxn && Math.abs(latestAmount - prevTxn.amount) > (prevTxn.amount * 0.02)) {
      if (latestAmount > prevTxn.amount) {
        flags.push('price_up');
        const month = getMonthName(latestTxn.date);
        flagMessages.push(`Price went up from ₹${prevTxn.amount} to ₹${latestAmount} in ${month}.`);
      }
    }

    // Flag 2: unused (membership companion check in last 90 days)
    if (COMPANIONS[merchantKey]) {
      const companionKey = COMPANIONS[merchantKey];
      const latestDateMs = new Date(latestTxn.date).getTime();
      const ninetyDaysAgoMs = latestDateMs - (90 * 24 * 60 * 60 * 1000);

      const companionTxnsIn90Days = transactions.filter(t => {
        if (t.direction !== 'debit') return false;
        if ((t.merchantKey || '').toUpperCase() !== companionKey) return false;
        const tDateMs = new Date(t.date).getTime();
        return tDateMs >= ninetyDaysAgoMs && tDateMs <= latestDateMs;
      });

      if (companionTxnsIn90Days.length <= 1) {
        flags.push('unused');
        const orderWord = companionTxnsIn90Days.length === 1 ? '1 order' : '0 orders';
        flagMessages.push(`${latestTxn.merchant}: ${orderWord} in 3 months.`);
      }
    }

    candidateSubscriptions.push({
      id: `sub_${merchantKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      merchant: latestTxn.merchant,
      merchantKey,
      amount: latestAmount,
      cadence,
      annualCost,
      lastDate: latestTxn.date,
      flags,
      flagMessages
    });
  }

  // Flag 3: overlap across active subscriptions
  for (const group of Object.values(OVERLAP_GROUPS)) {
    const overlapping = candidateSubscriptions.filter(s =>
      group.members.some(m => s.merchantKey.includes(m) || m.includes(s.merchantKey))
    );

    if (overlapping.length >= 2) {
      const names = overlapping.map(s => s.merchant).join(' and ');
      const msg = `Two ${group.label} at once: ${names}.`;

      for (const sub of overlapping) {
        if (!sub.flags.includes('overlap')) {
          sub.flags.push('overlap');
          sub.flagMessages.push(msg);
        }
      }
    }
  }

  return candidateSubscriptions.map(s => ({
    id: s.id,
    merchant: s.merchant,
    merchantKey: s.merchantKey,
    amount: s.amount,
    cadence: s.cadence,
    annualCost: s.annualCost,
    lastDate: s.lastDate,
    flags: s.flags,
    flagMessage: s.flagMessages.join(' ')
  }));
}

module.exports = {
  detectRecurring,
  COMPANIONS,
  OVERLAP_GROUPS,
  KNOWN_SUBSCRIPTION_MERCHANTS,
  isKnownSubscriptionMerchant,
  isRestrictedSubscriptionCategory
};
