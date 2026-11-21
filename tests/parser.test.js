const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseSms, parseInputText } = require('../lib/engine/parser');

describe('SMS Parser', () => {
  test('Format 1: UPI VPA debit with bank footer', () => {
    const raw = "Rs.450.00 debited from A/c XX1234 on 12-11-26 to VPA zomato@icici (UPI Ref 123456789). -HDFC Bank";
    const res = parseSms(raw);
    assert.ok(res, 'Should parse Format 1');
    assert.equal(res.amount, 450);
    assert.equal(res.date, '2026-11-12');
    assert.equal(res.direction, 'debit');
    assert.equal(res.merchantKey, 'ZOMATO');
  });

  test('Format 2: debited by with Info: UPI/... and ddMonyy', () => {
    const raw = "Your a/c XX1234 is debited by Rs 299.00 on 05Nov26. Info: UPI/NETFLIX/...";
    const res = parseSms(raw);
    assert.ok(res, 'Should parse Format 2');
    assert.equal(res.amount, 299);
    assert.equal(res.date, '2026-11-05');
    assert.equal(res.direction, 'debit');
    assert.equal(res.merchantKey, 'NETFLIX');
  });

  test('Format 3: Card spent at merchant with commas', () => {
    const raw = "INR 1,250.00 spent on HDFC Card XX9876 at SWIGGY on 14-Nov-26.";
    const res = parseSms(raw);
    assert.ok(res, 'Should parse Format 3');
    assert.equal(res.amount, 1250);
    assert.equal(res.date, '2026-11-14');
    assert.equal(res.direction, 'debit');
    assert.equal(res.merchantKey, 'SWIGGY');
  });

  test('Format 4: Salary credited via NEFT', () => {
    const raw = "Rs 82000 credited to A/c XX1234 on 01-Nov-26 by NEFT-ACME TECH SALARY";
    const res = parseSms(raw);
    assert.ok(res, 'Should parse Format 4');
    assert.equal(res.amount, 82000);
    assert.equal(res.date, '2026-11-01');
    assert.equal(res.direction, 'credit');
    assert.equal(res.merchantKey, 'ACME TECH SALARY');
  });

  test('Format 5: Sent Rs to merchant with slashes in date and alias collapse', () => {
    const raw = "Sent Rs.120.00 From HDFC Bank A/C *1234 To UBER INDIA On 10/11/26 Ref 123456";
    const res = parseSms(raw);
    assert.ok(res, 'Should parse Format 5');
    assert.equal(res.amount, 120);
    assert.equal(res.date, '2026-11-10');
    assert.equal(res.direction, 'debit');
    assert.equal(res.merchantKey, 'UBER');
  });

  test('Format 6: Paid rupee symbol to merchant with space-separated date', () => {
    const raw = "Paid ₹349 to JIO via PhonePe UPI on 09 Nov 2026";
    const res = parseSms(raw);
    assert.ok(res, 'Should parse Format 6');
    assert.equal(res.amount, 349);
    assert.equal(res.date, '2026-11-09');
    assert.equal(res.direction, 'debit');
    assert.equal(res.merchantKey, 'JIO');
  });

  test('Format 7: Dear customer debited for merchant with dd-mm-yyyy', () => {
    const raw = "Dear Customer, Rs 1,499.00 has been debited from your account ending 1234 for GYMKHANA FITNESS on 02-11-2026";
    const res = parseSms(raw);
    assert.ok(res, 'Should parse Format 7');
    assert.equal(res.amount, 1499);
    assert.equal(res.date, '2026-11-02');
    assert.equal(res.direction, 'debit');
    assert.equal(res.merchantKey, 'GYMKHANA FITNESS');
  });

  test('Garbage lines land in unparsed', async () => {
    const input = `Dear Customer, 842109 is secret OTP for your Card txn of INR 1,290.00 at AMAZON IN. Valid for 10 mins.

Sent 2,000 INR from GPay on Sunday evening. Memo: dinner split.`;

    const result = await parseInputText(input);
    assert.equal(result.transactions.length, 0);
    assert.equal(result.unparsed.length, 2);
  });

  test('AI fallback extracts transactions from irregular settlement messages', async () => {
    const { parseUnreadableSmsLines } = require('../lib/engine/ai');
    const irregular = [
      'Your payment of INR 850.00 to BLINKIT was successful on 15-Nov-2026. Ref: 981273',
      'Account XX4102 credited with Rs. 5000.00 on 12/11/2026 by refund from AMAZON'
    ];

    const extracted = await parseUnreadableSmsLines(irregular);
    assert.equal(extracted.length, 2);
    assert.equal(extracted[0].amount, 850);
    assert.equal(extracted[0].direction, 'debit');
    assert.equal(extracted[0].merchantKey, 'BLINKIT');
    assert.equal(extracted[1].amount, 5000);
    assert.equal(extracted[1].direction, 'credit');
    assert.equal(extracted[1].merchantKey, 'AMAZON');
  });
});
