/**
 * @file scripts/smoke.mjs
 * Smoke test suite that verifies all backend endpoints on http://127.0.0.1:3000.
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

const SAMPLE_RAW_SMS = `Rs 499.00 debited from A/C XX4102 on 12-Nov-26 to NETFLIX MUMBAI. Ref 631728192831. Bal Rs 41,200.00 - HDFC Bank
Paid Rs 340.00 to SWIGGY via UPI on 14-Nov-26. Ref 631892182912 - ICICI Bank
Salary of Rs 92,000.00 credited to A/C XX4102 on 01-Nov-26 by INFOSYS TECH LTD. Ref 630192830192. Bal Rs 1,32,400.00 - HDFC Bank`;

const SAMPLE_TRANSACTIONS = [
  {
    id: 'tx_1',
    date: '2026-11-01',
    amount: 92000,
    direction: 'credit',
    merchant: 'Infosys Tech Ltd',
    merchantKey: 'INFOSYS TECH LTD',
    category: 'Income',
    categorySource: 'keyword',
    rawText: 'Salary of Rs 92,000.00 credited to A/C XX4102 on 01-Nov-26'
  },
  {
    id: 'tx_2',
    date: '2026-11-12',
    amount: 499,
    direction: 'debit',
    merchant: 'Netflix',
    merchantKey: 'NETFLIX',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 499.00 debited to NETFLIX'
  },
  {
    id: 'tx_3',
    date: '2026-10-12',
    amount: 499,
    direction: 'debit',
    merchant: 'Netflix',
    merchantKey: 'NETFLIX',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 499.00 debited to NETFLIX in Oct'
  }
];

const SAMPLE_PROFILE = {
  monthlyIncome: 92000,
  fixedCosts: 33000
};

const SAMPLE_GOAL = {
  id: 'goal_1',
  name: 'Emergency Fund',
  targetAmount: 500000,
  targetDate: '2027-10-31',
  saved: 120000
};

async function testEndpoint(name, path, payload, validateFn) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[FAIL] ${name} -> HTTP ${res.status}: ${err}`);
      return false;
    }

    const data = await res.json();
    if (validateFn && !validateFn(data)) {
      console.error(`[FAIL] ${name} -> Validation failed:`, JSON.stringify(data).slice(0, 120));
      return false;
    }

    console.log(`[PASS] ${name}`);
    return true;
  } catch (err) {
    console.error(`[FAIL] ${name} -> ${err.message}`);
    return false;
  }
}

async function run() {
  console.log(`=== Munshi Backend Smoke Tests (${BASE_URL}) ===\n`);

  let passed = 0;
  let total = 0;

  total++;
  if (await testEndpoint(
    'POST /api/parse',
    '/api/parse',
    { text: SAMPLE_RAW_SMS },
    d => Array.isArray(d.transactions) && d.transactions.length >= 2
  )) passed++;

  total++;
  if (await testEndpoint(
    'POST /api/categorize',
    '/api/categorize',
    { transactions: SAMPLE_TRANSACTIONS, rules: [] },
    d => Array.isArray(d.transactions) && d.transactions.length === 3
  )) passed++;

  total++;
  if (await testEndpoint(
    'POST /api/learn',
    '/api/learn',
    {
      transaction: SAMPLE_TRANSACTIONS[1],
      category: 'Entertainment',
      transactions: SAMPLE_TRANSACTIONS,
      rules: []
    },
    d => d.rule && d.rule.category === 'Entertainment' && Array.isArray(d.transactions)
  )) passed++;

  total++;
  if (await testEndpoint(
    'POST /api/recurring',
    '/api/recurring',
    { transactions: SAMPLE_TRANSACTIONS },
    d => Array.isArray(d.subscriptions)
  )) passed++;

  total++;
  if (await testEndpoint(
    'POST /api/simulate',
    '/api/simulate',
    {
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      transactions: SAMPLE_TRANSACTIONS,
      adjustments: []
    },
    d => Array.isArray(d.months) && Array.isArray(d.continueSeries)
  )) passed++;

  total++;
  if (await testEndpoint(
    'POST /api/drift',
    '/api/drift',
    {
      transactions: SAMPLE_TRANSACTIONS,
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL
    },
    d => Array.isArray(d.nudges) && d.nudges.length > 0
  )) passed++;

  total++;
  if (await testEndpoint(
    'POST /api/letter',
    '/api/letter',
    {
      summary: {
        goalName: 'Emergency Fund',
        shortfallAtTarget: 25000,
        goalDatePlan: 'Oct 2027',
        goalDateContinue: 'Dec 2027',
        topCategory: 'Food & Dining',
        monthlyNet: 15000,
        cutPctNeeded: 15
      }
    },
    d => d.text && typeof d.text === 'string' && d.source
  )) passed++;

  total++;
  if (await testEndpoint(
    'POST /api/ask',
    '/api/ask',
    {
      question: 'Will I make it?',
      summary: {
        goalName: 'Emergency Fund',
        shortfallAtTarget: 0,
        goalDatePlan: 'Oct 2027',
        monthlyNet: 20000,
        topCategory: 'Food & Dining'
      },
      history: []
    },
    d => d.answer && typeof d.answer === 'string' && d.source
  )) passed++;

  console.log(`\nResults: ${passed} / ${total} endpoints passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

run();
