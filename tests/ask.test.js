const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  answerFutureQuestion,
  getPrecomputedAnswer,
  isValidSpokenAnswer
} = require('../lib/engine/ask');

describe('Future You Voice & Ask Engine', () => {
  const mockSummary = {
    goalName: 'Emergency Fund',
    targetAmount: 500000,
    targetDate: '2027-10-31',
    saved: 120000,
    monthlyIncome: 92000,
    monthlyFixed: 33000,
    monthlyVariable: 38430,
    monthlyNet: 20570,
    shortfallAtTarget: 25000,
    goalDateContinue: 'Dec 2027',
    goalDatePlan: 'Oct 2027',
    topCategory: 'Food & Dining',
    topOverspendRupeeGap: 3400,
    cutPctNeeded: 18
  };

  test('Question 1: "Will I make it?" returns a valid non-empty answer with no Gemini key', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await answerFutureQuestion({
        question: 'Will I make it?',
        summary: mockSummary,
        history: []
      });

      assert.ok(result, 'Result should exist');
      assert.ok(result.answer, 'Answer must not be empty');
      assert.equal(typeof result.answer, 'string');
      assert.equal(result.source, 'fallback');
      assert.ok(result.answer.length > 20, 'Answer should have substantive content');
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    }
  });

  test('Question 2: "What should I cut first?" returns a valid non-empty answer with no Gemini key', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await answerFutureQuestion({
        question: 'What should I cut first?',
        summary: mockSummary,
        history: []
      });

      assert.ok(result.answer, 'Answer must not be empty');
      assert.ok(result.answer.includes('Food & Dining') || result.answer.includes('Food'), 'Should mention topCategory');
      assert.equal(result.source, 'fallback');
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    }
  });

  test('Question 3: "What if rent goes up ₹3,000?" returns a valid non-empty answer with no Gemini key', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await answerFutureQuestion({
        question: 'What if rent goes up ₹3,000?',
        summary: mockSummary,
        history: []
      });

      assert.ok(result.answer, 'Answer must not be empty');
      assert.ok(result.answer.includes('rent') || result.answer.includes('savings'), 'Should discuss rent impact');
      assert.equal(result.source, 'fallback');
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    }
  });

  test('Hindi Question: "क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा?" returns natural Hindi response', async () => {
    const result = await answerFutureQuestion({
      question: 'क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा?',
      summary: mockSummary,
      history: [],
      lang: 'hi'
    });

    assert.ok(result.answer, 'Hindi answer must not be empty');
    assert.ok(result.answer.includes('लक्ष्य') || result.answer.includes('पहुँचोगे'), 'Should contain Hindi keywords');
    assert.equal(isValidSpokenAnswer(result.answer), true);
  });

  test('Answers never contain markdown formatting characters', async () => {
    const questions = [
      'Will I make it?',
      'What should I cut first?',
      'What if rent goes up ₹3,000?',
      'क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा?',
      'मुझे सबसे पहले क्या कम करना चाहिए?',
      'What is the weather today?'
    ];

    const markdownRegex = /[*#_`~\[\]]/;

    for (const q of questions) {
      const answer = getPrecomputedAnswer(q, mockSummary) || 'Standard plain spoken response.';
      assert.equal(
        markdownRegex.test(answer),
        false,
        `Answer for "${q}" should not contain markdown characters. Found in: ${answer}`
      );
    }
  });

  test('isValidSpokenAnswer strictly validates spoken suitability', () => {
    // Valid plain spoken sentences
    assert.equal(isValidSpokenAnswer('Yes you are on track. Keep this quiet discipline going.'), true);

    // Markdown bold or italic should fail
    assert.equal(isValidSpokenAnswer('Yes **you are on track**. Keep going.'), false);
    assert.equal(isValidSpokenAnswer('Yes _you are on track_. Keep going.'), false);

    // Markdown bullets should fail
    assert.equal(isValidSpokenAnswer('- Cut dining\n- Cut travel'), false);

    // Overlong text (> 80 words) should fail
    const overlong = new Array(85).fill('word').join(' ');
    assert.equal(isValidSpokenAnswer(overlong), false);
  });

  test('Dynamic question calculation: different rent amounts produce distinct, accurate answers', async () => {
    const res8000 = await answerFutureQuestion({
      question: 'what if my rent increases to 8000',
      summary: mockSummary,
      history: []
    });

    const res10000 = await answerFutureQuestion({
      question: 'what if my rent increases to 10000 rupees',
      summary: mockSummary,
      history: []
    });

    assert.notEqual(res8000.answer, res10000.answer, 'Answers for 8000 vs 10000 rent must be different');
    assert.ok(res8000.answer.includes('8,000') || res8000.answer.includes('8000'), 'Should mention 8,000 in answer');
    assert.ok(res10000.answer.includes('10,000') || res10000.answer.includes('10000'), 'Should mention 10,000 in answer');
  });

  test('Accurately answers status questions: rent, savings, income, and Hindi equivalents', async () => {
    // Current rent status
    const rentStatus = await answerFutureQuestion({
      question: 'what is my current rent?',
      summary: mockSummary,
      history: []
    });
    assert.ok(rentStatus.answer.includes('28,000'), 'Should mention current rent of ₹28,000');

    // Savings status
    const savingsStatus = await answerFutureQuestion({
      question: 'how much have I saved?',
      summary: mockSummary,
      history: []
    });
    assert.ok(savingsStatus.answer.includes('1,20,000') || savingsStatus.answer.includes('120000'), 'Should mention saved corpus');

    // Income status
    const incomeStatus = await answerFutureQuestion({
      question: 'what is my monthly income?',
      summary: mockSummary,
      history: []
    });
    assert.ok(incomeStatus.answer.includes('92,000') || incomeStatus.answer.includes('92000'), 'Should mention monthly income');

    // Hindi rent status
    const hindiRent = await answerFutureQuestion({
      question: 'मेरा किराया कितना है?',
      summary: mockSummary,
      history: [],
      lang: 'hi'
    });
    assert.ok(hindiRent.answer.includes('किराया') && (hindiRent.answer.includes('28,000') || hindiRent.answer.includes('28000')), 'Should answer Hindi rent correctly');

    // Hindi savings status
    const hindiSavings = await answerFutureQuestion({
      question: 'मेरी बचत कितनी है?',
      summary: mockSummary,
      history: [],
      lang: 'hi'
    });
    assert.ok(hindiSavings.answer.includes('1,20,000') || hindiSavings.answer.includes('120000'), 'Should answer Hindi savings correctly');
  });

  test('House vs Car purchase questions produce distinct, specific financial advice', async () => {
    const resHouse = await answerFutureQuestion({
      question: 'what if I want to buy a new house',
      summary: mockSummary,
      history: []
    });

    const resCar = await answerFutureQuestion({
      question: 'what if I want to buy a new car',
      summary: mockSummary,
      history: []
    });

    // They must NOT be identical
    assert.notEqual(resHouse.answer, resCar.answer, 'Answers for buying a house vs buying a car must be distinct');

    // Neither should be the generic fallback
    assert.equal(resHouse.answer.includes('convenience purchase'), false, 'Should not use generic convenience fallback for house');
    assert.equal(resCar.answer.includes('convenience purchase'), false, 'Should not use generic convenience fallback for car');

    // House answer must discuss home-specific financial concepts
    assert.ok(
      resHouse.answer.toLowerCase().includes('home') ||
      resHouse.answer.toLowerCase().includes('house') ||
      resHouse.answer.toLowerCase().includes('down payment'),
      'House answer should discuss home purchase finances'
    );

    // Car answer must discuss car/vehicle-specific financial concepts
    assert.ok(
      resCar.answer.toLowerCase().includes('car') ||
      resCar.answer.toLowerCase().includes('vehicle') ||
      resCar.answer.toLowerCase().includes('emi'),
      'Car answer should discuss vehicle purchase finances'
    );
  });
});
