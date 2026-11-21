const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getFallbackLetter, isValidLetter, checkRateLimit, formatRupees } = require('../lib/engine/letter');

describe('Letter Engine & Rate Limiter', () => {
  test('Fallback template 1: Net negative generates valid letter', () => {
    const summary = {
      goalName: 'Emergency Corpus',
      targetDate: 'Oct 2027',
      monthlyNet: -2000,
      topCategory: 'Food & Dining',
      cutPctNeeded: 25
    };

    const letter = getFallbackLetter(summary);
    assert.ok(letter.text, 'Letter text must exist');
    assert.equal(letter.source, 'fallback');
    assert.ok(letter.text.includes('standstill'), 'Should pick net negative template');
    assert.ok(isValidLetter(letter.text), 'Letter text must be valid format without markdown');
  });

  test('Fallback template 2: Shortfall generates valid letter with rupee shortfall', () => {
    const summary = {
      goalName: 'Emergency Corpus',
      targetDate: 'Oct 2027',
      goalDateContinue: 'Dec 2027',
      monthlyNet: 15000,
      shortfallAtTarget: 35000,
      topCategory: 'Online Shopping',
      cutPctNeeded: 20
    };

    const letter = getFallbackLetter(summary);
    assert.ok(letter.text, 'Letter text must exist');
    assert.equal(letter.source, 'fallback');
    assert.ok(letter.text.includes('missed it by ₹35,000'), 'Should contain formatted shortfall');
    assert.ok(isValidLetter(letter.text), 'Letter text must be valid format without markdown');
  });

  test('Fallback template 3: On-track surplus generates encouraging letter', () => {
    const summary = {
      goalName: 'Emergency Corpus',
      targetDate: 'Oct 2027',
      monthlyNet: 22000,
      shortfallAtTarget: 0,
      topCategory: 'Food & Dining'
    };

    const letter = getFallbackLetter(summary);
    assert.ok(letter.text, 'Letter text must exist');
    assert.equal(letter.source, 'fallback');
    assert.ok(letter.text.includes('You made it'), 'Should pick on-track template');
    assert.ok(isValidLetter(letter.text), 'Letter text must be valid format without markdown');
  });

  test('Hindi Fallback templates generate valid Devanagari letters', () => {
    const summaryNegative = {
      goalName: 'आपातकालीन फंड',
      targetDate: 'अक्टूबर 2027',
      monthlyNet: -1500,
      topCategory: 'खान-पान',
      cutPctNeeded: 20
    };
    const letterHi1 = getFallbackLetter(summaryNegative, 'hi');
    assert.ok(letterHi1.text.includes('ख़त लिख रहा हूँ'), 'Should have Hindi greeting/body');
    assert.ok(isValidLetter(letterHi1.text), 'Hindi letter must be valid');

    const summarySurplus = {
      goalName: 'आपातकालीन फंड',
      targetDate: 'अक्टूबर 2027',
      monthlyNet: 25000,
      shortfallAtTarget: 0,
      topCategory: 'खान-पान'
    };
    const letterHi2 = getFallbackLetter(summarySurplus, 'hi');
    assert.ok(letterHi2.text.includes('तुमने कर दिखाया'), 'Should have encouraging Hindi message');
    assert.ok(isValidLetter(letterHi2.text), 'Hindi letter must be valid');
  });

  test('formatRupees formats Indian currency commas correctly', () => {
    assert.equal(formatRupees(15000), '₹15,000');
    assert.equal(formatRupees(125000), '₹1,25,000');
    assert.equal(formatRupees(0), '₹0');
  });

  test('checkRateLimit restricts requests after limit exceeded within 60s', () => {
    const testIp = '192.168.1.99';
    // Limit to 3 requests
    assert.equal(checkRateLimit(testIp, 3), true, 'Request 1 should pass');
    assert.equal(checkRateLimit(testIp, 3), true, 'Request 2 should pass');
    assert.equal(checkRateLimit(testIp, 3), true, 'Request 3 should pass');
    assert.equal(checkRateLimit(testIp, 3), false, 'Request 4 should be blocked');
  });
});
