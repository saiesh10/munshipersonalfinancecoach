/**
 * @file lib/engine/ask.js
 * "Future You" conversational engine.
 * Pure logic providing dynamic financial simulations, Gemini generation,
 * sliding-window rate limiting, and mathematically accurate what-if answers in English and Hindi.
 */

const { callGemini } = require('./ai');
const { checkRateLimit } = require('./letter');

/**
 * Clean LLM answer and ensure it strictly contains no markdown and is under 80 words.
 * @param {string} text
 * @returns {boolean}
 */
function isValidSpokenAnswer(text) {
  if (!text || typeof text !== 'string') return false;
  // Strictly reject markdown tokens: bold, italics, headers, bullets, backticks
  if (/[#*_`~\[\]]/.test(text) || /^\s*[-*•]\s+/m.test(text) || /^\d+\.\s+/m.test(text)) {
    return false;
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 4 && words.length <= 80;
}

/**
 * Extract numbers/amounts from text (e.g. 8000, 10000, 10k, ₹5,000).
 * @param {string} text
 * @returns {number | null}
 */
function extractAmount(text) {
  if (!text || typeof text !== 'string') return null;

  // Match "10k", "8.5k"
  const kMatch = text.match(/\b([0-9]+(?:\.[0-9]+)?)\s*k\b/i);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  // Match numbers with rupee prefixes/suffixes or standalone
  const numMatch = text.match(/(?:Rs\.?|INR|₹)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:rupees|rs|inr)?/i);
  if (numMatch && numMatch[1]) {
    const clean = numMatch[1].replace(/,/g, '');
    const num = parseFloat(clean);
    // Ignore current/upcoming calendar years
    if (!isNaN(num) && num > 0 && num !== 2026 && num !== 2027 && num !== 2028) {
      return Math.round(num);
    }
  }

  return null;
}

/**
 * Calculate dynamic, mathematically accurate financial answers for what-ifs,
 * timeline simulations, rent hikes, salary changes, and purchases.
 * @param {string} question
 * @param {Object} summary
 * @param {string} [lang='en']
 * @returns {string}
 */
function getDynamicFinancialAnswer(question, summary = {}, lang = 'en') {
  const q = question.toLowerCase().trim();
  const isHindi = (lang || summary?.lang || '').toLowerCase().startsWith('hi') || /[\u0900-\u097F]/.test(q);

  const goalName = summary.goalName || (isHindi ? 'तुम्हारा लक्ष्य' : 'Emergency Fund');
  const targetDate = summary.goalDatePlan || (isHindi ? 'अक्टूबर 2027' : 'Oct 2027');
  const continueDate = summary.goalDateContinue || (isHindi ? 'दिसंबर 2027' : 'Dec 2027');
  const monthlyIncome = Number(summary.monthlyIncome) || 92000;
  const monthlyFixed = Number(summary.monthlyFixed) || 33000;
  const monthlyVariable = Number(summary.monthlyVariable) || 38430;
  const monthlyNet = Number(summary.monthlyNet) || 20570;
  const shortfall = Number(summary.shortfallAtTarget) || 0;
  const topCat = summary.topCategory || (isHindi ? 'खान-पान' : 'Food & Dining');
  const topOverspendGap = Number(summary.topOverspendRupeeGap) || 2500;
  const cutPct = summary.cutPctNeeded ? `${summary.cutPctNeeded}%` : '15%';

  const targetAmount = Number(summary.targetAmount) || 500000;
  const saved = Number(summary.saved) || 120000;
  const remaining = Math.max(0, targetAmount - saved);
  const currRent = Number(summary.currentRent) || 28000;
  const currMonths = Math.ceil(remaining / Math.max(1, monthlyNet));

  // 1. "Who are you?" / "What is Munshi?"
  if (
    q.includes('who are you') ||
    q.includes('what are you') ||
    q.includes('what is munshi') ||
    q.includes('तुम कौन हो') ||
    q.includes('आप कौन हैं') ||
    q.includes('मुंशी क्या है')
  ) {
    return isHindi
      ? `मैं आपका भविष्य हूँ—उस मंज़िल की तारीख से बात कर रहा हूँ जहाँ आपने ${goalName} हासिल कर लिया है। मैं आपकी बचत सुरक्षित रखने और वित्तीय अनुशासन में मदद करने के लिए यहाँ हूँ।`
      : `I am Future You—speaking from your arrival date where you successfully reached ${goalName}. I am here to help you protect your savings and stay quietly disciplined.`;
  }

  // 2. Current Rent Status (e.g. "what is my current rent", "how much is my rent", "मेरा किराया कितना है")
  const isRentStatusQuery =
    (/\b(?:what is|what's|how much|tell me)\b.*?\b(?:rent)\b/i.test(q) ||
     /\b(?:how much rent do i pay|how much do i pay for rent|current rent)\b/i.test(q) ||
     /किराया कितना|किराया क्या/.test(q)) &&
    !/\b(?:increase|raise|boost|drop|cut|decrease|extra|loss|what if|hike|बढ़|अगर)\b/i.test(q);

  if (isRentStatusQuery) {
    const rentPct = Math.round((currRent / Math.max(1, monthlyIncome)) * 100);
    return isHindi
      ? `आपका वर्तमान मकान किराया ₹${currRent.toLocaleString('en-IN')} प्रति माह है, जो आपकी आय का लगभग ${rentPct}% और कुल फिक्स्ड खर्चों (₹${monthlyFixed.toLocaleString('en-IN')}) का मुख्य हिस्सा है।`
      : `Your current house rent is ₹${currRent.toLocaleString('en-IN')} per month, which takes up about ${rentPct}% of your monthly income and forms the core of your fixed costs (₹${monthlyFixed.toLocaleString('en-IN')}).`;
  }

  // 3. Rent & Housing Changes (e.g. "what if my rent increases to 8000", "what if my rent increases to 10000 rupees", "what if rent goes up by 3000")
  if (
    q.includes('rent') ||
    q.includes('किराया') ||
    q.includes('housing') ||
    q.includes('room rent')
  ) {
    const extractedNum = extractAmount(q);
    const isTo = /\b(?:increases|rises|goes up|climbs)\s+to\b/i.test(q) || /\bto\s+[0-9]/i.test(q) || /\bहो जाए\b/.test(q);

    // If an amount was specified (e.g. 8000, 10000, 3000)
    if (extractedNum) {
      // Case A: User specifies a target rent that is lower than current rent (e.g. rent becomes 8000 down from 28000)
      if (isTo && extractedNum < currRent) {
        const savingsGain = currRent - extractedNum;
        const newNetGain = monthlyNet + savingsGain;
        const newMonthsGain = Math.ceil(remaining / Math.max(1, newNetGain));
        const advanceMonths = Math.max(1, currMonths - newMonthsGain);

        return isHindi
          ? `यदि आपका मासिक किराया घटकर ₹${extractedNum.toLocaleString('en-IN')} हो जाता है, तो हमारी मासिक बचत ₹${savingsGain.toLocaleString('en-IN')} बढ़कर ₹${newNetGain.toLocaleString('en-IN')} हो जाएगी, जिससे ${goalName} लगभग ${advanceMonths} महीने पहले हासिल हो जाएगा!`
          : `If your monthly rent drops to ₹${extractedNum.toLocaleString('en-IN')} (down from ₹${currRent.toLocaleString('en-IN')}), our monthly savings surge by ₹${savingsGain.toLocaleString('en-IN')} to ₹${newNetGain.toLocaleString('en-IN')}, reaching ${goalName} about ${advanceMonths} months sooner!`;
      }

      // Case B: Rent increases to an amount higher than current rent (e.g. to 35000 from 28000)
      let hike = 3000;
      if (isTo && extractedNum > currRent) {
        hike = extractedNum - currRent;
      } else {
        // Direct hike (e.g. rent increases by 8000 or 10000)
        hike = extractedNum;
      }

      const newNet = monthlyNet - hike;
      const newMonths = newNet > 0 ? Math.ceil(remaining / newNet) : Infinity;
      const delay = isFinite(newMonths) ? Math.max(1, newMonths - currMonths) : null;

      if (newNet > 0) {
        return isHindi
          ? `अगर किराया ₹${hike.toLocaleString('en-IN')} बढ़ जाता है, तो हमारी मासिक बचत घटकर ₹${newNet.toLocaleString('en-IN')} रह जाएगी, जिससे ${goalName} लगभग ${delay} ${delay === 1 ? 'महीना' : 'महीने'} पिछड़ जाएगा। ${topCat} और अन्य ऐच्छिक खर्चों में संयम बरतने से इस बढ़ोतरी का असर समाप्त हो जाएगा और हमारी तारीख सुरक्षित रहेगी।`
          : `If rent rises by ₹${hike.toLocaleString('en-IN')}, our monthly savings drop to ₹${newNet.toLocaleString('en-IN')}, delaying ${goalName} by about ${delay} ${delay === 1 ? 'month' : 'months'}. Trimming discretionary spending across ${topCat} helps absorb this hike and protects our goal date.`;
      }

      return isHindi
        ? `अगर किराया ₹${hike.toLocaleString('en-IN')} बढ़ता है, तो हमारी मासिक बचत शून्य या नकारात्मक हो जाएगी, जिससे ${goalName} की प्रगति रुक जाएगी। हमें तुरंत अपने गैर-ज़रूरी खर्चों में कटौती करनी होगी ताकि हमारी नींव सुरक्षित रहे।`
        : `If rent rises by ₹${hike.toLocaleString('en-IN')}, our monthly savings drop to ₹0 or turn negative, wiping out our cushion for ${goalName}. We would need to immediately tighten discretionary spending to protect our foundation.`;
    }

    // Default rent what-if (₹3,000 hike)
    const hike = 3000;
    const newNet = monthlyNet - hike;
    const delay = Math.max(1, Math.ceil(remaining / Math.max(1, newNet)) - currMonths);
    return isHindi
      ? `अगर किराया ₹${hike.toLocaleString('en-IN')} बढ़ जाता है, तो हमारी मासिक बचत घटकर ₹${newNet.toLocaleString('en-IN')} रह जाएगी, जिससे ${goalName} लगभग ${delay} महीने पिछड़ जाएगा। ${topCat} में संयम बरतने से यह अंतर पूरा हो सकता है।`
      : `If rent rises by ₹${hike.toLocaleString('en-IN')}, our monthly savings drop to ₹${newNet.toLocaleString('en-IN')}, delaying ${goalName} by about ${delay} month. Trimming discretionary spending across ${topCat} absorbs the hike and keeps our target date intact.`;
  }

  // 4. Current Savings / Net Worth / Accumulated Funds
  if (
    q.includes('saved') ||
    q.includes('my savings') ||
    q.includes('current balance') ||
    q.includes('how much money do i have') ||
    q.includes('how much have i saved') ||
    q.includes('बचत कितनी है') ||
    q.includes('कितनी बचत') ||
    q.includes('सेविंग्स') ||
    q.includes('जमा राशि')
  ) {
    const pct = Math.round((saved / Math.max(1, targetAmount)) * 100);
    return isHindi
      ? `आपके पास ${goalName} के ₹${targetAmount.toLocaleString('en-IN')} के लक्ष्य में से अब तक ₹${saved.toLocaleString('en-IN')} जमा हो चुके हैं (${pct}% पूरा)। लक्ष्य तक पहुँचने के लिए अभी ₹${remaining.toLocaleString('en-IN')} शेष हैं।`
      : `You have accumulated ₹${saved.toLocaleString('en-IN')} toward your ${goalName} target of ₹${targetAmount.toLocaleString('en-IN')} (${pct}% funded). You have ₹${remaining.toLocaleString('en-IN')} left to reach the finish line.`;
  }

  // 5. Current Income & Salary Status
  const isIncomeStatusQuery =
    (/\b(?:what is|what's|how much|tell me)\b.*?\b(?:income|salary|earnings?)\b/i.test(q) ||
     /\b(?:how much do i earn|how much do i make)\b/i.test(q) ||
     /आय|सैलरी|कमाई/.test(q)) &&
    !/\b(?:increase|raise|boost|drop|cut|decrease|extra|loss|what if|बढ़|अगर)\b/i.test(q);

  if (isIncomeStatusQuery) {
    return isHindi
      ? `आपकी दर्ज मासिक आय ₹${monthlyIncome.toLocaleString('en-IN')} है। ₹${monthlyFixed.toLocaleString('en-IN')} के निश्चित खर्चों और ₹${monthlyVariable.toLocaleString('en-IN')} के सामान्य खर्चों के बाद, आप हर महीने ₹${monthlyNet.toLocaleString('en-IN')} की शुद्ध बचत करते हैं।`
      : `Your monthly income is ₹${monthlyIncome.toLocaleString('en-IN')}. After ₹${monthlyFixed.toLocaleString('en-IN')} in fixed obligations and ₹${monthlyVariable.toLocaleString('en-IN')} in living expenses, you retain a monthly net savings margin of ₹${monthlyNet.toLocaleString('en-IN')}.`;
  }

  // 6. Monthly Savings / Margin
  if (
    q.includes('how much do i save') ||
    q.includes('monthly savings') ||
    q.includes('how much can i save') ||
    q.includes('savings rate') ||
    q.includes('हर महीने बचत') ||
    q.includes('मासिक बचत')
  ) {
    const rate = Math.round((monthlyNet / Math.max(1, monthlyIncome)) * 100);
    return isHindi
      ? `आप वर्तमान में हर महीने ₹${monthlyNet.toLocaleString('en-IN')} की बचत कर रहे हैं, जो आपकी आय का ${rate}% है। इस अनुशासित रफ़्तार से आप ${continueDate} तक ${goalName} हासिल कर लेंगे।`
      : `You are currently saving ₹${monthlyNet.toLocaleString('en-IN')} per month—a ${rate}% savings rate on your ₹${monthlyIncome.toLocaleString('en-IN')} income. This pace carries you to ${goalName} around ${continueDate}.`;
  }

  // 7. Monthly Total Spend / Expenses
  if (
    q.includes('how much do i spend') ||
    q.includes('total spend') ||
    q.includes('total expenses') ||
    q.includes('monthly expenses') ||
    q.includes('कुल खर्च') ||
    q.includes('महीने का खर्च') ||
    q.includes('कितना खर्च')
  ) {
    const totalOutflow = monthlyFixed + monthlyVariable;
    return isHindi
      ? `आपका कुल मासिक खर्च ₹${totalOutflow.toLocaleString('en-IN')} है—जिसमें ₹${monthlyFixed.toLocaleString('en-IN')} फिक्स्ड खर्चे (किराया, बिल) और ₹${monthlyVariable.toLocaleString('en-IN')} खान-पान व दैनिक खर्च शामिल हैं।`
      : `Your total monthly spend is ₹${totalOutflow.toLocaleString('en-IN')}, consisting of ₹${monthlyFixed.toLocaleString('en-IN')} in fixed commitments (rent, utilities) and ₹${monthlyVariable.toLocaleString('en-IN')} in variable living costs.`;
  }

  // 8. Fixed Costs / Commitments
  if (
    q.includes('fixed costs') ||
    q.includes('fixed expenses') ||
    q.includes('फिक्स्ड खर्चे') ||
    q.includes('निश्चित खर्च')
  ) {
    return isHindi
      ? `आपके निश्चित मासिक खर्चे कुल ₹${monthlyFixed.toLocaleString('en-IN')} हैं, जिसमें मकान किराया (₹${currRent.toLocaleString('en-IN')}) और नियमित घरेलू बिल शामिल हैं।`
      : `Your fixed monthly commitments total ₹${monthlyFixed.toLocaleString('en-IN')}, which includes House Rent (₹${currRent.toLocaleString('en-IN')}) and essential recurring bills.`;
  }

  // 9. Goal & Target Date
  if (
    q.includes('what is my goal') ||
    q.includes('when will i reach') ||
    q.includes('target date') ||
    q.includes('लक्ष्य क्या है') ||
    q.includes('लक्ष्य कब पूरा होगा') ||
    q.includes('कब तक पहुँचे')
  ) {
    return isHindi
      ? `आपका लक्ष्य ₹${targetAmount.toLocaleString('en-IN')} का ${goalName} है। मौजूदा बचत दर (₹${monthlyNet.toLocaleString('en-IN')}/माह) से आप ${continueDate} तक पहुँचेंगे। योजना के थोड़े सुधारों से आप इसे ${targetDate} तक पा सकते हैं।`
      : `Your goal is ${goalName} for ₹${targetAmount.toLocaleString('en-IN')}. At your current savings rate of ₹${monthlyNet.toLocaleString('en-IN')}/month, you will reach it around ${continueDate}. With your plan optimizations, you arrive by ${targetDate}.`;
  }

  // 10. Where Does My Money Go / Top Leaks / Subscriptions
  if (
    q.includes('where does my money go') ||
    q.includes('biggest expense') ||
    q.includes('quiet leaks') ||
    q.includes('leak') ||
    q.includes('subscriptions') ||
    q.includes('सबसे ज्यादा खर्च') ||
    q.includes('खर्च कहाँ') ||
    q.includes('सब्सक्रिप्शन')
  ) {
    return isHindi
      ? `निश्चित किराए के अलावा, आपका सबसे बड़ा खर्च ${topCat} में हो रहा है (जो सामान्य से लगभग ₹${topOverspendGap.toLocaleString('en-IN')} अधिक चल रहा है)। वहाँ थोड़ी समझदारी से खर्च करने से तुरंत अतिरिक्त बचत बनेगी।`
      : `Aside from fixed rent, your biggest variable spending category is ${topCat} (running about ₹${topOverspendGap.toLocaleString('en-IN')} above baseline). Trimming ${cutPct} there creates immediate breathing room.`;
  }

  // 11. Salary & Income Adjustments (e.g. "what if my salary increases by 10000", "what if I get a 15000 raise")
  if (
    q.includes('salary') ||
    q.includes('income') ||
    q.includes('raise') ||
    q.includes('bonus') ||
    q.includes('वेतन') ||
    q.includes('कमाई')
  ) {
    const amount = extractAmount(q) || 10000;
    const isDecrease = /\b(?:drop|cut|decrease|loss|reduce|कम)\b/i.test(q);
    const delta = isDecrease ? -amount : amount;
    const newNet = monthlyNet + delta;

    if (delta > 0) {
      const newMonths = Math.ceil(remaining / Math.max(1, newNet));
      const advance = Math.max(1, currMonths - newMonths);
      return isHindi
        ? `मासिक आय में ₹${amount.toLocaleString('en-IN')} की बढ़ोतरी से हमारी बचत ₹${newNet.toLocaleString('en-IN')} हो जाएगी, जिससे हम ${goalName} तय समय से लगभग ${advance} महीने पहले ही हासिल कर लेंगे!`
        : `With a ₹${amount.toLocaleString('en-IN')} monthly income boost, our savings margin rises to ₹${newNet.toLocaleString('en-IN')}, reaching ${goalName} about ${advance} ${advance === 1 ? 'month' : 'months'} ahead of schedule!`;
    }

    const delay = Math.max(1, Math.ceil(remaining / Math.max(1, newNet)) - currMonths);
    return isHindi
      ? `यदि मासिक आय में ₹${amount.toLocaleString('en-IN')} की कमी आती है, तो बचत घटकर ₹${newNet.toLocaleString('en-IN')} रह जाएगी, जिससे ${goalName} लगभग ${delay} महीने पिछड़ जाएगा।`
      : `If monthly income drops by ₹${amount.toLocaleString('en-IN')}, our savings shrink to ₹${newNet.toLocaleString('en-IN')}, delaying ${goalName} by about ${delay} months.`;
  }

  // 12. House / Flat / Property Purchase (e.g. "what if I want to buy a new house", "can I buy a flat")
  if (
    q.includes('house') ||
    q.includes('home') ||
    q.includes('flat') ||
    q.includes('apartment') ||
    q.includes('property') ||
    q.includes('real estate') ||
    q.includes('घर') ||
    q.includes('मकान') ||
    q.includes('प्लॉट')
  ) {
    const amount = extractAmount(q);
    if (amount) {
      const downPayment = Math.round(amount * 0.2);
      const monthsForDownPayment = Math.ceil(downPayment / Math.max(1, monthlyNet));
      return isHindi
        ? `₹${amount.toLocaleString('en-IN')} का घर लेने के लिए 20% डाउन पेमेंट (₹${downPayment.toLocaleString('en-IN')}) जुटाने में हमारी लगभग ${monthsForDownPayment} महीने की शुद्ध बचत लगेगी। पहले [${targetDate}] तक ${goalName} पूरा करके सुरक्षा पक्की करें, फिर बाकी बचत को होम लोन में लगाएं।`
        : `Buying a ₹${amount.toLocaleString('en-IN')} home requires a 20% down payment (₹${downPayment.toLocaleString('en-IN')}), which takes about ${monthsForDownPayment} months of our net savings. Let us first secure ${goalName} by ${targetDate}, then redirect our ₹${currRent.toLocaleString('en-IN')} rent budget toward a home loan EMI.`;
    }

    const downPaymentEst = 1500000;
    const monthsEst = Math.ceil(downPaymentEst / Math.max(1, monthlyNet));
    return isHindi
      ? `नया घर खरीदने के लिए कम से कम 20% डाउन पेमेंट (लगभग ₹10-15 लाख) और लंबी अवधि की EMI की आवश्यकता होगी। हमारी वर्तमान ₹${monthlyNet.toLocaleString('en-IN')}/माह की बचत के साथ, पहले ${targetDate} तक ${goalName} पूरा करना सबसे ज़रूरी है। इसके बाद किराए का ₹${currRent.toLocaleString('en-IN')} और मासिक बचत होम लोन में सुरक्षित लगाई जा सकती है।`
      : `Buying a house requires a solid down payment (typically ₹10L–₹15L) plus a 15–20 year EMI. With our current savings of ₹${monthlyNet.toLocaleString('en-IN')}/month and ₹${saved.toLocaleString('en-IN')} saved, our first priority must be completing ${goalName} by ${targetDate}. Once our safety net is funded, our ₹${currRent.toLocaleString('en-IN')} rent plus surplus savings can safely fund a home loan.`;
  }

  // 13. Car / Vehicle / Bike Purchase (e.g. "what if I want to buy a new car", "can I buy a bike")
  if (
    q.includes('car') ||
    q.includes('vehicle') ||
    q.includes('bike') ||
    q.includes('scooter') ||
    q.includes('automobile') ||
    q.includes('कार') ||
    q.includes('गाड़ी') ||
    q.includes('बाइक') ||
    q.includes('स्कूटर')
  ) {
    const amount = extractAmount(q);
    if (amount) {
      const monthsCost = (amount / Math.max(1, monthlyNet)).toFixed(1);
      const delayMonths = Math.ceil(amount / Math.max(1, monthlyNet));
      return isHindi
        ? `₹${amount.toLocaleString('en-IN')} की गाड़ी लेना हमारी लगभग ${monthsCost} महीने की शुद्ध बचत के बराबर है, जिससे ${goalName} करीब ${delayMonths} महीने पिछड़ जाएगा। इसे तभी लें जब हमारे पास डाउन पेमेंट के लिए अलग फंड हो और EMI मासिक बचत के 25% से कम रहे।`
        : `A ₹${amount.toLocaleString('en-IN')} vehicle represents about ${monthsCost} months of our net savings, pushing ${goalName} back by roughly ${delayMonths} months. To buy it safely, ensure the monthly EMI remains below 25% of our monthly surplus rather than draining our core cushion.`;
    }

    const estCost = 800000;
    const estMonths = Math.ceil(estCost / Math.max(1, monthlyNet));
    return isHindi
      ? `एक नई कार के लिए लगभग ₹1.5-2.5 लाख डाउन पेमेंट और ₹12,000-16,000 प्रति माह की EMI (ईंधन और बीमा सहित) लगेगी। यह हमारी ₹${monthlyNet.toLocaleString('en-IN')}/माह की बचत का बड़ा हिस्सा ले लेगी, जिससे ${goalName} पिछड़ सकता है। पहले अपना लक्ष्य पूरा करें, फिर कार के लिए एक अलग फंड बनाएं।`
      : `A new car typically requires a ₹1.5L–₹2L down payment and adds an ongoing EMI of ₹12,000–₹16,000/month plus fuel and insurance. That would consume a substantial portion of our ₹${monthlyNet.toLocaleString('en-IN')}/month savings, delaying ${goalName}. I recommend securing our foundation first before taking on vehicle debt.`;
  }

  // 14. Gadgets / Electronics (e.g. "can I buy an iPhone", "what if I buy a laptop")
  if (
    q.includes('iphone') ||
    q.includes('laptop') ||
    q.includes('macbook') ||
    q.includes('phone') ||
    q.includes('mobile') ||
    q.includes('ipad') ||
    q.includes('gadget') ||
    q.includes('tv') ||
    q.includes('आईफोन') ||
    q.includes('लैपटॉप') ||
    q.includes('फोन')
  ) {
    const amount = extractAmount(q) || 75000;
    const monthsCost = (amount / Math.max(1, monthlyNet)).toFixed(1);
    const delayMonths = Math.ceil(amount / Math.max(1, monthlyNet));
    return isHindi
      ? `₹${amount.toLocaleString('en-IN')} का गैजेट हमारी लगभग ${monthsCost} महीने की बचत के बराबर है। अपनी मुख्य बचत को तोड़े बिना इसे खरीदने के लिए अगले 2-3 महीनों में ₹${Math.round(amount / 3).toLocaleString('en-IN')}/माह का अलग फंड बनाएं।`
      : `A ₹${amount.toLocaleString('en-IN')} device represents about ${monthsCost} months of our net savings (delaying ${goalName} by roughly ${delayMonths} month). To afford it guilt-free without touching our emergency cushion, set aside ₹${Math.round(amount / 3).toLocaleString('en-IN')}/month over the next 3 months.`;
  }

  // 15. Travel / Vacation / Trip
  if (
    q.includes('trip') ||
    q.includes('vacation') ||
    q.includes('holiday') ||
    q.includes('travel') ||
    q.includes('tour') ||
    q.includes('घूमना') ||
    q.includes('यात्रा') ||
    q.includes('छुट्टी')
  ) {
    const amount = extractAmount(q) || 45000;
    const monthsCost = (amount / Math.max(1, monthlyNet)).toFixed(1);
    return isHindi
      ? `₹${amount.toLocaleString('en-IN')} का ट्रिप हमारी लगभग ${monthsCost} महीने की बचत के बराबर है। यात्रा ज़रूरी है, लेकिन इसके लिए हमारी मुख्य बचत से एकमुश्त खर्च करने के बजाय हर महीने ₹10,000 का अलग ट्रैवल फंड बनाना सबसे सुरक्षित रहेगा।`
      : `A ₹${amount.toLocaleString('en-IN')} trip equals about ${monthsCost} months of our net savings. Travel is rewarding, but fund it via a dedicated monthly sinking fund rather than pulling a lump sum out of ${goalName}.`;
  }

  // 16. Investments, Mutual Funds, Stocks, Gold, SIP
  if (
    q.includes('invest') ||
    q.includes('mutual fund') ||
    q.includes('sip') ||
    q.includes('stocks') ||
    q.includes('shares') ||
    q.includes('gold') ||
    q.includes('fd') ||
    q.includes('equity') ||
    q.includes('निवेश') ||
    q.includes('म्यूचुअल फंड') ||
    q.includes('शेयर')
  ) {
    return isHindi
      ? `हमारी ₹${monthlyNet.toLocaleString('en-IN')}/माह की बचत के साथ, पहले ${targetDate} तक ${goalName} (₹${targetAmount.toLocaleString('en-IN')}) पूरा करके लिक्विड फंड में सुरक्षित रखें। इसके बाद पूरी मासिक बचत को डायवर्सिफाइड इंडेक्स म्यूचुअल फंड में SIP के ज़रिये निवेश करना सबसे समझदारी भरा निर्णय होगा।`
      : `With our ₹${monthlyNet.toLocaleString('en-IN')}/month surplus, our first priority is keeping our ${goalName} (₹${targetAmount.toLocaleString('en-IN')}) in a liquid safety net by ${targetDate}. Once that cushion is locked in, directing that surplus into diversified index fund SIPs will build long-term wealth.`;
  }

  // 17. Loans, Debt, EMI, Credit Cards
  if (
    q.includes('loan') ||
    q.includes('debt') ||
    q.includes('emi') ||
    q.includes('credit card') ||
    q.includes('borrow') ||
    q.includes('कर्ज') ||
    q.includes('उधार') ||
    q.includes('किस्त')
  ) {
    return isHindi
      ? `उच्च ब्याज वाले कर्ज़ (जैसे 36-42% वाले क्रेडिट कार्ड) को बचत से पहले चुकाना सबसे ज़रूरी है। अगर आपके पास कोई पर्सनल लोन या क्रेडिट कार्ड बकाया है, तो अतिरिक्त बचत का उपयोग पहले उसे समाप्त करने में करें ताकि हर महीने का कैश फ्लो सुरक्षित हो सके।`
      : `High-interest debt (like credit cards charging 36–42% APR) should always be cleared before aggressive saving. If you carry personal debt outside our fixed commitments, clearing it frees up monthly cash flow and permanently accelerates your progress.`;
  }

  // 18. Emergency Fund & Safety Net
  if (
    q.includes('emergency fund') ||
    q.includes('safety net') ||
    q.includes('cushion') ||
    q.includes('आपातकालीन') ||
    q.includes('सुरक्षा')
  ) {
    const monthlyExpenses = monthlyFixed + monthlyVariable;
    const monthsCovered = (targetAmount / Math.max(1, monthlyExpenses)).toFixed(1);
    return isHindi
      ? `हमारा ₹${targetAmount.toLocaleString('en-IN')} का ${goalName} हमारे कुल मासिक खर्च (₹${monthlyExpenses.toLocaleString('en-IN')}) के लगभग ${monthsCovered} महीनों को कवर करता है। यह फंड हमें नौकरी छूटने या अचानक मेडिकल खर्चों के समय बिना किसी कर्ज़ के सुरक्षित रखेगा।`
      : `Our ₹${targetAmount.toLocaleString('en-IN')} ${goalName} covers roughly ${monthsCovered} months of total living expenses (₹${monthlyExpenses.toLocaleString('en-IN')}). This cushion protects you from job shocks or medical surprises without ever needing high-cost loans.`;
  }

  // 19. How to Save More & Budgeting Advice
  if (
    q.includes('how to save') ||
    q.includes('save more') ||
    q.includes('tips') ||
    q.includes('cut expenses') ||
    q.includes('बचत कैसे') ||
    q.includes('पैसे कैसे बचाएं') ||
    q.includes('सलाह')
  ) {
    return isHindi
      ? `बचत बढ़ाने के लिए 3 आसान कदम उठाएं: 1) ${topCat} पर ${cutPct} कम खर्च करें (हर महीने ₹${topOverspendGap.toLocaleString('en-IN')} की बचत होगी), 2) गैर-ज़रूरी सब्सक्रिप्शन बंद करें, और 3) वेतन आते ही सबसे पहले ₹${monthlyNet.toLocaleString('en-IN')} बचत खाते में अलग कर दें।`
      : `Three high-impact steps to boost savings right now: 1) Trim ${cutPct} from ${topCat} to instantly free up ₹${topOverspendGap.toLocaleString('en-IN')}/month, 2) Cancel dormant quiet subscriptions, and 3) Automate your ₹${monthlyNet.toLocaleString('en-IN')} transfer to savings the day your salary arrives.`;
  }

  // 20. Financial Health & Situation Overview
  if (
    q.includes('how am i doing') ||
    q.includes('financial health') ||
    q.includes('my situation') ||
    q.includes('overview') ||
    q.includes('कैसी चल रही है') ||
    q.includes('मेरी स्थिति')
  ) {
    const savingsRate = Math.round((monthlyNet / Math.max(1, monthlyIncome)) * 100);
    return isHindi
      ? `आपकी वित्तीय स्थिति बहुत मज़बूत है! आप अपनी आय का ${savingsRate}% (₹${monthlyNet.toLocaleString('en-IN')}/माह) बचा रहे हैं। वर्तमान रफ़्तार से हम ${continueDate} तक ₹${targetAmount.toLocaleString('en-IN')} का ${goalName} पूरा कर लेंगे। बस ${topCat} के खर्चों पर नज़र रखें।`
      : `Your financial foundation is very strong! You are saving ${savingsRate}% of your income (₹${monthlyNet.toLocaleString('en-IN')}/month). At this pace, you reach our ₹${targetAmount.toLocaleString('en-IN')} ${goalName} around ${continueDate}. Stay mindful of ${topCat} drift and you will cruise across the line.`;
  }

  // 21. General Discretionary Purchases (with amount)
  if (
    q.includes('buy') ||
    q.includes('purchase') ||
    q.includes('spend') ||
    q.includes('खरीद') ||
    q.includes('खर्च')
  ) {
    const amount = extractAmount(q);
    if (amount) {
      const monthsCost = (amount / Math.max(1, monthlyNet)).toFixed(1);
      const delayMonths = Math.ceil(amount / Math.max(1, monthlyNet));
      return isHindi
        ? `₹${amount.toLocaleString('en-IN')} खर्च करना हमारी लगभग ${monthsCost} महीने की बचत के बराबर है, जिससे ${goalName} करीब ${delayMonths} महीने पीछे खिसक सकता है। इसे सुरक्षित रूप से खरीदने के लिए अपनी मुख्य बचत को छुए बिना एक अलग फंड बनाएं।`
        : `Spending ₹${amount.toLocaleString('en-IN')} represents about ${monthsCost} months of our net savings, pushing ${goalName} back by roughly ${delayMonths} ${delayMonths === 1 ? 'month' : 'months'}. To afford it safely, set aside a separate sinking fund rather than tapping our core savings.`;
    }
  }

  // 22. "Will I make it?" / "On track"
  if (
    q.includes('will i make it') ||
    q.includes('can i reach') ||
    q.includes('on track') ||
    q.includes('पहुँच') ||
    q.includes('लक्ष्य') ||
    q.includes('पूरा होगा')
  ) {
    if (shortfall <= 0 && monthlyNet > 0) {
      return isHindi
        ? `हाँ, तुम ${targetDate} तक ${goalName} पूरा करने की सही राह पर हो। हर महीने ₹${monthlyNet.toLocaleString('en-IN')} की बचत हमें बिना किसी परेशानी के लक्ष्य तक पहुँचा देगी। इस संयम को बनाए रखो।`
        : `Yes, you are on track to reach ${goalName} by ${targetDate}. Keeping our monthly savings margin steady at ₹${monthlyNet.toLocaleString('en-IN')} gets us across the line with room to spare. Keep this quiet discipline going.`;
    }
    return isHindi
      ? `वर्तमान रफ़्तार से, तुम ${continueDate} के आसपास ${goalName} तक पहुँचोगे, जो कि हमारे ${targetDate} के लक्ष्य से लगभग ₹${shortfall.toLocaleString('en-IN')} पीछे है। ${topCat} पर हर महीने ${cutPct} कम खर्च करने से यह अंतर पूरी तरह भर जाएगा। आज का एक छोटा कदम परिणाम बदल सकता है।`
      : `At your current pace, you will reach ${goalName} around ${continueDate}, falling about ₹${shortfall.toLocaleString('en-IN')} short of our ${targetDate} date. Cutting ${cutPct} on ${topCat} each month closes the gap completely. We are close enough that a small fix today changes the outcome.`;
  }

  // 23. "What should I cut first?"
  if (
    q.includes('what should i cut') ||
    q.includes('cut first') ||
    q.includes('where to cut') ||
    q.includes('कम करना चाहिए') ||
    q.includes('कहाँ कटौती') ||
    q.includes('खर्च कम')
  ) {
    const leakRupees = summary.topOverspendRupeeGap ? `₹${summary.topOverspendRupeeGap.toLocaleString('en-IN')}` : (isHindi ? 'काफी अधिक' : 'a substantial amount');
    return isHindi
      ? `सबसे पहले ${topCat} से शुरुआत करो। यह हमारे सामान्य खर्च से ${leakRupees} अधिक चल रहा है और यहाँ कटौती करना सबसे आसान है। वहाँ ${cutPct} कम करने से हमारा लक्ष्य सुरक्षित रहेगा और हर महीने बचत बढ़ेगी।`
      : `Start with ${topCat}. It is running ${leakRupees} above our normal baseline and holds the easiest savings without hurting your day-to-day life. Trimming ${cutPct} there protects our goal date and keeps money in our pocket.`;
  }

  // 24. Out-of-scope non-money question detection
  const nonMoneyKeywords = ['weather', 'cricket', 'recipe', 'movie', 'joke', 'poem', 'president', 'capital of', 'मौसम', 'गाना', 'कविता', 'क्रिकेट', 'फिल्म', 'चुटकुला'];
  if (nonMoneyKeywords.some(kw => q.includes(kw))) {
    return isHindi
      ? 'मैं केवल आपके पैसों और इस लक्ष्य तक की हमारी यात्रा के बारे में बात कर सकता हूँ। मुझसे बचत, किराया या खर्चों के बारे में पूछें।'
      : 'I can only speak about your money and our shared journey to this goal. Ask me about your savings, rent, or leaks.';
  }

  // 25. Legal / Tax / Stock picking advice disclaimer
  const legalTaxKeywords = ['crypto', 'stock pick', 'tax filing', 'legal', 'itr', 'lawyer', 'bitcoin', 'शेयर', 'टैक्स', 'वकील'];
  if (legalTaxKeywords.some(kw => q.includes(kw))) {
    return isHindi
      ? 'मैं आपका भविष्य हूँ, कोई वित्तीय या कर सलाहकार नहीं। कानूनी, टैक्स या निवेश निर्णयों के लिए कृपया किसी योग्य पेशेवर से सलाह लें।'
      : 'I am your future self, not a certified advisor. For legal, tax, or specific investment decisions, please consult a qualified professional.';
  }

  // 26. Intelligent Contextual Dynamic Fallback (Never repeat identical template)
  const savingsRate = Math.round((monthlyNet / Math.max(1, monthlyIncome)) * 100);
  if (q.includes('why') || q.includes('क्यों')) {
    return isHindi
      ? `क्योंकि आज बचाया गया हर रुपया भविष्य में हमें वित्तीय स्वतंत्रता देता है। ₹${monthlyNet.toLocaleString('en-IN')}/माह की बचत दर बनाए रखकर हम बिना किसी तनाव के ${targetDate} तक ${goalName} हासिल कर सकते हैं।`
      : `Because every rupee saved today buys us freedom tomorrow. Keeping our monthly savings steady at ₹${monthlyNet.toLocaleString('en-IN')} ensures we reach ${goalName} by ${targetDate} with peace of mind.`;
  }

  if (q.includes('can i') || q.includes('should i') || q.includes('क्या मैं')) {
    return isHindi
      ? `वर्तमान में हमारी मासिक बचत ₹${monthlyNet.toLocaleString('en-IN')} है। जब तक ${targetDate} का ${goalName} लक्ष्य सुरक्षित है, आप छोटे ऐच्छिक खर्च कर सकते हैं, बशर्ते मुख्य आपातकालीन फंड प्रभावित न हो।`
      : `With our monthly savings of ₹${monthlyNet.toLocaleString('en-IN')}, you have reasonable flexibility as long as ${goalName} remains on pace for ${targetDate}. Avoid dipping into your primary cushion for unbudgeted desires.`;
  }

  return isHindi
    ? `अपनी मंज़िल से देखते हुए, सबसे महत्वपूर्ण बात अपनी ₹${monthlyNet.toLocaleString('en-IN')}/माह की बचत दर को बनाए रखना है। ₹${saved.toLocaleString('en-IN')} की बचत के साथ हम ${goalName} के बहुत करीब हैं। अनुशासन बनाए रखें!`
    : `Looking back from our milestone, maintaining our ₹${monthlyNet.toLocaleString('en-IN')}/month savings rate is the single highest-leverage habit. With ₹${saved.toLocaleString('en-IN')} already saved toward ${goalName}, quiet consistency will get us there.`;
}

/**
 * Handle question to Future You with Gemini and dynamic mathematical fallback.
 * @param {Object} params
 * @param {string} params.question
 * @param {Object} params.summary
 * @param {Array<{q: string, a: string}>} [params.history=[]]
 * @param {string} [params.clientIp='127.0.0.1']
 * @param {string} [params.lang='en']
 * @returns {Promise<{ answer: string, source: 'gemini' | 'fallback' }>}
 */
async function answerFutureQuestion({ question, summary, history = [], clientIp = '127.0.0.1', lang = 'en' }) {
  const cleanQ = question.trim();
  const rateLimitPerMin = parseInt(process.env.RATE_LIMIT_PER_MIN || '20', 10);
  const selectedLang = (lang || summary?.lang || 'en').toLowerCase();
  const isHindi = selectedLang.startsWith('hi') || /[\u0900-\u097F]/.test(cleanQ);

  // Exact chips matching (for instant response on standard UI buttons)
  const exactChips = [
    'will i make it?',
    'will i make it',
    'what should i cut first?',
    'what should i cut first',
    'what if rent goes up ₹3,000?',
    'what if rent goes up 3000?',
    'क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा?',
    'क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा',
    'मुझे सबसे पहले क्या कम करना चाहिए?',
    'मुझे सबसे पहले क्या कम करना चाहिए',
    'अगर किराया ₹3,000 बढ़ जाए तो क्या होगा?',
    'अगर किराया ₹3,000 बढ़ जाए तो क्या होगा'
  ];

  const lowerQ = cleanQ.toLowerCase();
  const isExactChip = exactChips.includes(lowerQ);

  // If rate limit exceeded, return dynamic fallback immediately
  if (!checkRateLimit(clientIp, rateLimitPerMin)) {
    return {
      answer: getDynamicFinancialAnswer(cleanQ, summary, isHindi ? 'hi' : 'en'),
      source: 'fallback'
    };
  }

  // If Gemini API Key is available AND this is not an exact chip, query Gemini for dynamic reasoning
  if (process.env.GEMINI_API_KEY && !isExactChip) {
    const goalName = summary.goalName || 'Goal';
    const targetDate = summary.goalDatePlan || 'target arrival date';
    const monthlyNet = summary.monthlyNet || 20570;
    const currentRent = summary.currentRent || 28000;
    const topCat = summary.topCategory || 'Food & Dining';

    const system = isHindi
      ? `You are the user's future self, speaking out loud in first person from your goal date (${targetDate}) where you reached ${goalName}. Natural conversational Hindi (Devanagari script), friendly and plain-spoken, no hype, no emojis, no bullet points, under 60 words. The user asked a specific question. Answer it directly and calculate the exact rupee and month effect using their data: Monthly Income: ₹${summary.monthlyIncome || 92000}, Current Rent: ₹${currentRent}, Monthly Net Savings: ₹${monthlyNet}, Top Leak: ${topCat}. If they ask what if rent/expenses change, calculate the exact new savings and delay or advance in months. Never repeat a canned response.`
      : `You are the user's future self, speaking out loud in first person from your goal date (${targetDate}) where you reached ${goalName}. Indian English, warm and plain-spoken, no hype, no emojis, no bullet points, under 60 words. The user asked a specific question. Answer it directly and calculate the exact rupee and month effect using their data: Monthly Income: ₹${summary.monthlyIncome || 92000}, Current Rent: ₹${currentRent}, Monthly Net Savings: ₹${monthlyNet}, Top Leak: ${topCat}. If they ask what if rent or expenses change, calculate the exact new savings and delay or advance in months. Never repeat a canned response.`;

    const conversationHistory = (history || []).slice(-3).map(turn => `User: ${turn.q}\nFuture You: ${turn.a}`).join('\n\n');

    const prompt = `Current Financial Summary:
${JSON.stringify(summary, null, 2)}

${conversationHistory ? `Recent Dialogue:\n${conversationHistory}\n\n` : ''}User's Question: "${cleanQ}"

Answer directly as their future self in plain spoken text without any markdown or formatting:`;

    try {
      const rawAnswer = await callGemini({
        system,
        prompt,
        json: false,
        maxTokens: 140
      });

      const cleaned = rawAnswer
        .replace(/^["']|["']$/g, '')
        .replace(/[*#_~`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (isValidSpokenAnswer(cleaned)) {
        return {
          answer: cleaned,
          source: 'gemini'
        };
      }
    } catch {
      // Fall through to dynamic math solver
    }
  }

  // Calculate dynamic answer based on the exact user question and financial summary
  return {
    answer: getDynamicFinancialAnswer(cleanQ, summary, isHindi ? 'hi' : 'en'),
    source: 'fallback'
  };
}

module.exports = {
  answerFutureQuestion,
  getDynamicFinancialAnswer,
  getPrecomputedAnswer: getDynamicFinancialAnswer, // Backward-compatibility for test imports
  extractAmount,
  isValidSpokenAnswer
};
