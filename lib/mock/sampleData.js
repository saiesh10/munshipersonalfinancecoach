/**
 * @file lib/mock/sampleData.js
 * Realistic sample Indian banking data for demonstration and offline mode.
 */

export const SAMPLE_RAW_SMS = `Rs 499.00 debited from A/C XX4102 on 12-Nov-26 to NETFLIX MUMBAI. Ref 631728192831. Bal Rs 41,200.00 - HDFC Bank
Paid Rs 340.00 to SWIGGY via UPI on 14-Nov-26. Ref 631892182912 - ICICI Bank
Rs 1,450.00 debited from A/C XX4102 on 15-Nov-26 to NATURES BASKET BANDRA. Ref 631900124810. Bal Rs 39,410.00 - HDFC Bank
Rs 120.00 debited via UPI from A/C XX4102 to BLUE TOKAI COFFEE on 15-Nov-26. Ref 631988271615. Bal Rs 39,290.00
Salary of Rs 92,000.00 credited to A/C XX4102 on 01-Nov-26 by INFOSYS TECH LTD. Ref 630192830192. Bal Rs 1,32,400.00 - HDFC Bank
Paid Rs 2,800.00 to URBAN COMPANY on 16-Nov-26 via UPI. Ref 632019281726 - HDFC Bank
Rs 150.00 debited from A/C XX4102 on 18-Nov-26 to QUICK COMMERCE ZEPTO. Ref 632291028301 - HDFC Bank
Rs 299.00 debited from A/C XX4102 on 18-Nov-26 to HOTSTAR SUBSCRIPTION. Ref 632291028399 - HDFC Bank
Rs 1,499.00 debited from A/C XX4102 on 19-Nov-26 to SWIGGY ONE MEMBERSHIP. Ref 632391028399 - HDFC Bank
Dear Customer, 842109 is secret OTP for your Card txn of INR 1,290.00 at AMAZON IN. Valid for 10 mins.
Sent 2,000 INR from GPay on Sunday evening. Memo: dinner split.`;

export const SAMPLE_PROFILE = {
  name: 'Arjun Mehta',
  monthlyIncome: 92000,
  fixedCosts: [
    { name: 'House Rent', amount: 28000 },
    { name: 'Apartment Maintenance', amount: 3500 },
    { name: 'Broadband & Mobile', amount: 1500 }
  ]
};

export const SAMPLE_GOAL = {
  id: 'goal_1',
  name: 'Emergency Corpus & Ladakh Fund',
  targetAmount: 500000,
  targetDate: '2027-10-31',
  saved: 120000
};

export const SAMPLE_RULES = [
  {
    id: 'rule_swiggy',
    merchantKey: 'SWIGGY',
    category: 'Food & Dining',
    matchType: 'exact',
    hits: 14,
    createdAt: '2026-10-01T00:00:00.000Z'
  },
  {
    id: 'rule_netflix',
    merchantKey: 'NETFLIX',
    category: 'Subscriptions',
    matchType: 'exact',
    hits: 4,
    createdAt: '2026-10-01T00:00:00.000Z'
  }
];

export const SAMPLE_TRANSACTIONS = [
  {
    id: 'tx_nov_salary',
    date: '2026-11-01',
    amount: 92000,
    direction: 'credit',
    merchant: 'Infosys Tech Ltd',
    merchantKey: 'INFOSYS TECH LTD',
    category: 'Income',
    categorySource: 'keyword',
    rawText: 'Salary of Rs 92,000.00 credited to A/C XX4102 on 01-Nov-26 by INFOSYS TECH LTD.'
  },
  {
    id: 'tx_nov_netflix',
    date: '2026-11-12',
    amount: 499,
    direction: 'debit',
    merchant: 'Netflix',
    merchantKey: 'NETFLIX',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 499.00 debited from A/C XX4102 on 12-Nov-26 to NETFLIX MUMBAI.'
  },
  {
    id: 'tx_oct_netflix',
    date: '2026-10-12',
    amount: 499,
    direction: 'debit',
    merchant: 'Netflix',
    merchantKey: 'NETFLIX',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 499.00 debited from A/C XX4102 on 12-Oct-26 to NETFLIX MUMBAI.'
  },
  {
    id: 'tx_sep_netflix',
    date: '2026-09-12',
    amount: 499,
    direction: 'debit',
    merchant: 'Netflix',
    merchantKey: 'NETFLIX',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 499.00 debited from A/C XX4102 on 12-Sep-26 to NETFLIX MUMBAI.'
  },
  {
    id: 'tx_nov_hotstar',
    date: '2026-11-18',
    amount: 299,
    direction: 'debit',
    merchant: 'Hotstar',
    merchantKey: 'HOTSTAR',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 299.00 debited from A/C XX4102 on 18-Nov-26 to HOTSTAR.'
  },
  {
    id: 'tx_oct_hotstar',
    date: '2026-10-18',
    amount: 149,
    direction: 'debit',
    merchant: 'Hotstar',
    merchantKey: 'HOTSTAR',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 149.00 debited from A/C XX4102 on 18-Oct-26 to HOTSTAR.'
  },
  {
    id: 'tx_nov_swiggy_one',
    date: '2026-11-19',
    amount: 1499,
    direction: 'debit',
    merchant: 'Swiggy One',
    merchantKey: 'SWIGGY ONE',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 1,499.00 debited from A/C XX4102 on 19-Nov-26 to SWIGGY ONE MEMBERSHIP.'
  },
  {
    id: 'tx_oct_swiggy_one',
    date: '2026-10-19',
    amount: 1499,
    direction: 'debit',
    merchant: 'Swiggy One',
    merchantKey: 'SWIGGY ONE',
    category: 'Subscriptions',
    categorySource: 'keyword',
    rawText: 'Rs 1,499.00 debited from A/C XX4102 on 19-Oct-26 to SWIGGY ONE MEMBERSHIP.'
  },
  {
    id: 'tx_nov_swiggy',
    date: '2026-11-14',
    amount: 340,
    direction: 'debit',
    merchant: 'Swiggy',
    merchantKey: 'SWIGGY',
    category: 'Food & Dining',
    categorySource: 'rule',
    rawText: 'Paid Rs 340.00 to SWIGGY via UPI on 14-Nov-26.'
  },
  {
    id: 'tx_nov_groceries',
    date: '2026-11-15',
    amount: 1450,
    direction: 'debit',
    merchant: 'Natures Basket',
    merchantKey: 'NATURES BASKET',
    category: 'Groceries',
    categorySource: 'keyword',
    rawText: 'Rs 1,450.00 debited from A/C XX4102 on 15-Nov-26 to NATURES BASKET BANDRA.'
  },
  {
    id: 'tx_nov_zepto',
    date: '2026-11-18',
    amount: 150,
    direction: 'debit',
    merchant: 'Zepto',
    merchantKey: 'ZEPTO',
    category: 'Groceries',
    categorySource: 'keyword',
    rawText: 'Rs 150.00 debited from A/C XX4102 on 18-Nov-26 to QUICK COMMERCE ZEPTO.'
  },
  {
    id: 'tx_nov_coffee',
    date: '2026-11-15',
    amount: 120,
    direction: 'debit',
    merchant: 'Blue Tokai',
    merchantKey: 'BLUE TOKAI',
    category: 'Food & Dining',
    categorySource: 'keyword',
    rawText: 'Rs 120.00 debited via UPI from A/C XX4102 to BLUE TOKAI COFFEE on 15-Nov-26.'
  },
  {
    id: 'tx_nov_urban',
    date: '2026-11-16',
    amount: 2800,
    direction: 'debit',
    merchant: 'Urban Company',
    merchantKey: 'URBAN COMPANY',
    category: 'Other',
    categorySource: 'unsure',
    rawText: 'Paid Rs 2,800.00 to URBAN COMPANY on 16-Nov-26 via UPI.'
  }
];
