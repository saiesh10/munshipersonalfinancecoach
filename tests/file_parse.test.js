const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseInputText } = require('../lib/engine/parser');
const { parseCsv } = require('../lib/engine/csv');
const { parseUnreadableSmsLines } = require('../lib/engine/ai');

describe('Uploaded File Message Parsing', () => {
  test('Uploaded text file with SMS messages is parsed completely', async () => {
    const uploadedFileText = `Rs 499.00 debited from A/C XX4102 on 12-Nov-26 to NETFLIX MUMBAI. Ref 631728192831. Bal Rs 41,200.00 - HDFC Bank
Paid Rs 340.00 to SWIGGY via UPI on 14-Nov-26. Ref 631892182912 - ICICI Bank
INR 1,250.00 spent on HDFC Card XX9876 at SWIGGY on 14-Nov-26.
Rs 82000 credited to A/c XX1234 on 01-Nov-26 by NEFT-ACME TECH SALARY`;

    const result = await parseInputText(uploadedFileText, parseUnreadableSmsLines);
    assert.equal(result.transactions.length, 4, 'All 4 messages should be extracted');
    assert.equal(result.unparsed.length, 0, 'No messages should be unparsed');
  });

  test('Uploaded CSV file without debit/credit columns but with SMS messages is parsed', async () => {
    const uploadedCsv = `Date,Narration
12/11/2026,Rs 499.00 debited from A/C XX4102 on 12-Nov-26 to NETFLIX MUMBAI
14/11/2026,Paid Rs 340.00 to SWIGGY via UPI on 14-Nov-26`;

    const result = parseCsv(uploadedCsv);
    assert.equal(result.transactions.length, 2, 'Both rows should be extracted via row-level parser');
    assert.equal(result.unparsed.length, 0);
  });

  test('Uploaded file with irregular lines triggers AI / heuristic extraction', async () => {
    const messyUploadedText = `Your payment of INR 850.00 to BLINKIT was successful on 15-Nov-2026. Ref: 981273
Account XX4102 credited with Rs. 5000.00 on 12/11/2026 by refund from AMAZON`;

    const result = await parseInputText(messyUploadedText, parseUnreadableSmsLines);
    assert.equal(result.transactions.length, 2, 'AI/heuristic fallback should extract both irregular messages');
    const blinkit = result.transactions.find(t => t.merchantKey === 'BLINKIT');
    const amazon = result.transactions.find(t => t.merchantKey === 'AMAZON');
    assert.ok(blinkit, 'BLINKIT transaction should be extracted');
    assert.ok(amazon, 'AMAZON transaction should be extracted');
    assert.equal(blinkit.amount, 850);
    assert.equal(amazon.amount, 5000);
  });
});
