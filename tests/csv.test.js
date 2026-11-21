const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv } = require('../lib/engine/csv');

describe('CSV Parser', () => {
  test('HDFC-style CSV with metadata preamble rows and Withdrawal/Deposit columns', () => {
    const csv = `HDFC Bank Account Statement
Account No: 50100234567890
Statement Period: 01-11-2026 to 20-11-2026
Generated On: 20-11-2026

Date,Narration,Withdrawal Amt,Deposit Amt,Closing Balance
12/11/2026,UPI-NETFLIX-631728192831,499.00,,41200.00
14/11/2026,POS 4102 SWIGGY BANGALORE,340.00,,40860.00
01/11/2026,NEFT-INFOSYS SALARY NOV,,92000.00,132860.00`;

    const result = parseCsv(csv);
    assert.equal(result.transactions.length, 3);

    const netflix = result.transactions.find(t => t.merchantKey.includes('NETFLIX'));
    assert.ok(netflix);
    assert.equal(netflix.amount, 499);
    assert.equal(netflix.direction, 'debit');
    assert.equal(netflix.date, '2026-11-12');

    const salary = result.transactions.find(t => t.amount === 92000);
    assert.ok(salary);
    assert.equal(salary.direction, 'credit');
    assert.equal(salary.date, '2026-11-01');
  });

  test('SBI-style CSV with header preamble and Debit/Credit columns', () => {
    const csv = `STATE BANK OF INDIA
Account Name: Arjun Mehta
IFS Code: SBIN0001234
Account Number: 00000030123456789

Txn Date,Particulars,Debit,Credit,Balance
15/11/2026,TO TRANSFER-UPI/DR/NATURES BASKET,1450.00,,39410.00
18/11/2026,TO TRANSFER-UPI/DR/ZEPTO,150.00,,39260.00`;

    const result = parseCsv(csv);
    assert.equal(result.transactions.length, 2);

    const zepto = result.transactions.find(t => t.merchantKey.includes('ZEPTO'));
    assert.ok(zepto);
    assert.equal(zepto.amount, 150);
    assert.equal(zepto.direction, 'debit');
    assert.equal(zepto.date, '2026-11-18');
  });

  test('CSV with SMS message column extracts transactions via row-level parser', () => {
    const csv = `Date,Message
14/11/2026,Paid Rs 340.00 to SWIGGY via UPI on 14-Nov-26. Ref 631892182912
12/11/2026,Rs 499.00 debited from A/C XX4102 on 12-Nov-26 to NETFLIX MUMBAI`;

    const result = parseCsv(csv);
    assert.equal(result.transactions.length, 2);
    assert.equal(result.transactions[0].amount, 340);
    assert.equal(result.transactions[0].merchantKey, 'SWIGGY');
    assert.equal(result.transactions[1].amount, 499);
    assert.equal(result.transactions[1].merchantKey, 'NETFLIX');
  });
});
