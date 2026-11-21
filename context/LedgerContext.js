'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  parseInput,
  categorizeBatch,
  learnRule,
  detectRecurring,
  simulate as clientSimulate,
  getDrift,
  writeLetter
} from '@/lib/client';

import {
  SAMPLE_RAW_SMS,
  SAMPLE_TRANSACTIONS,
  SAMPLE_RULES,
  SAMPLE_PROFILE,
  SAMPLE_GOAL
} from '@/lib/mock/sampleData';

const LedgerContext = createContext(null);

const STORAGE_KEYS = {
  TRANSACTIONS: 'munshi_transactions',
  RULES: 'munshi_rules',
  SUBSCRIPTIONS: 'munshi_subscriptions',
  PROFILE: 'munshi_profile',
  GOAL: 'munshi_goal',
  ADJUSTMENTS: 'munshi_adjustments',
  PROJECTION: 'munshi_projection',
  NUDGES: 'munshi_nudges',
  LETTER: 'munshi_letter',
  UNPARSED: 'munshi_unparsed'
};

const DEFAULT_PROFILE = {
  name: 'Householder',
  monthlyIncome: 92000,
  fixedCosts: [
    { name: 'House Rent', amount: 28000 },
    { name: 'Apartment Maintenance', amount: 3500 },
    { name: 'Broadband & Mobile', amount: 1500 }
  ]
};

const DEFAULT_GOAL = {
  id: 'goal_emergency',
  name: 'Emergency Corpus & Future Safety',
  targetAmount: 500000,
  targetDate: '2027-10-31',
  saved: 120000
};

export function LedgerProvider({ children, initialTab = 'overview' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [transactions, setTransactions] = useState([]);
  const [rules, setRules] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [adjustments, setAdjustments] = useState([]);
  const [projection, setProjection] = useState(null);
  const [nudges, setNudges] = useState([]);
  const [letter, setLetter] = useState(null);
  const [unparsed, setUnparsed] = useState([]);
  const [lastParseStats, setLastParseStats] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const isLoadedRef = useRef(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedTxns = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const savedRules = localStorage.getItem(STORAGE_KEYS.RULES);
      const savedSubs = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
      const savedProf = localStorage.getItem(STORAGE_KEYS.PROFILE);
      const savedGoal = localStorage.getItem(STORAGE_KEYS.GOAL);
      const savedAdj = localStorage.getItem(STORAGE_KEYS.ADJUSTMENTS);
      const savedProj = localStorage.getItem(STORAGE_KEYS.PROJECTION);
      const savedNudges = localStorage.getItem(STORAGE_KEYS.NUDGES);
      const savedLetter = localStorage.getItem(STORAGE_KEYS.LETTER);
      const savedUnparsed = localStorage.getItem(STORAGE_KEYS.UNPARSED);

      if (savedTxns) setTransactions(JSON.parse(savedTxns));
      if (savedRules) setRules(JSON.parse(savedRules));
      if (savedSubs) setSubscriptions(JSON.parse(savedSubs));
      if (savedProf) setProfile(JSON.parse(savedProf));
      if (savedGoal) setGoal(JSON.parse(savedGoal));
      if (savedAdj) setAdjustments(JSON.parse(savedAdj));
      if (savedProj) setProjection(JSON.parse(savedProj));
      if (savedNudges) setNudges(JSON.parse(savedNudges));
      if (savedLetter) setLetter(JSON.parse(savedLetter));
      if (savedUnparsed) setUnparsed(JSON.parse(savedUnparsed));
    } catch {
      // Local storage unreadable or disabled
    } finally {
      isLoadedRef.current = true;
    }
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    if (!isLoadedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subscriptions));
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      localStorage.setItem(STORAGE_KEYS.GOAL, JSON.stringify(goal));
      localStorage.setItem(STORAGE_KEYS.ADJUSTMENTS, JSON.stringify(adjustments));
      localStorage.setItem(STORAGE_KEYS.PROJECTION, JSON.stringify(projection));
      localStorage.setItem(STORAGE_KEYS.NUDGES, JSON.stringify(nudges));
      localStorage.setItem(STORAGE_KEYS.LETTER, JSON.stringify(letter));
      localStorage.setItem(STORAGE_KEYS.UNPARSED, JSON.stringify(unparsed));
    } catch {
      // Quota exceeded or private browsing
    }
  }, [transactions, rules, subscriptions, profile, goal, adjustments, projection, nudges, letter, unparsed]);

  // Read / Parse and Categorize flow
  const handleParseAndCategorize = useCallback(async ({ text, csv }) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Parse text and/or CSV
      const parseRes = await parseInput({ text, csv });
      const rawNewTxns = parseRes.transactions || [];
      const newUnparsed = parseRes.unparsed || [];

      // 2. Batch categorize new transactions
      const catRes = await categorizeBatch({ transactions: rawNewTxns, rules });
      const categorizedNewTxns = catRes.transactions || rawNewTxns;

      // 3. Deduplicate and merge with existing transactions
      const seenIds = new Set(transactions.map(t => t.id));
      const combined = [...transactions];
      for (const t of categorizedNewTxns) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          combined.push(t);
        }
      }

      // 4. Detect recurring charges
      const recRes = await detectRecurring({ transactions: combined });
      const newSubs = recRes.subscriptions || [];

      setTransactions(combined);
      setSubscriptions(newSubs);
      setUnparsed(newUnparsed);
      setLastParseStats({
        discovered: rawNewTxns.length + newUnparsed.length,
        parsed: rawNewTxns.length,
        unparsed: newUnparsed.length
      });

      return {
        success: true,
        count: rawNewTxns.length,
        unparsedCount: newUnparsed.length
      };
    } catch (err) {
      setError(err.message || 'Failed to read financial text');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [transactions, rules]);

  // Learn Rule flow when user edits a category in the Ledger
  const handleLearnRule = useCallback(async (transaction, newCategory) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await learnRule({
        transaction,
        category: newCategory,
        transactions,
        rules
      });

      const updatedRule = res.rule;
      const updatedTxns = res.transactions;
      const affectedCount = res.affectedCount || 0;

      // Update or add rule in rules list
      const nextRules = [...rules.filter(r => r.merchantKey !== updatedRule.merchantKey), updatedRule];

      // Refresh subscriptions
      const recRes = await detectRecurring({ transactions: updatedTxns });

      setRules(nextRules);
      setTransactions(updatedTxns);
      setSubscriptions(recRes.subscriptions || []);

      return { success: true, affectedCount };
    } catch (err) {
      setError(err.message || 'Failed to update ledger category');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [transactions, rules]);

  // Simulation and Drift flow
  const handleSimulate = useCallback(async (currentAdjustments = adjustments, profileOverride = null, goalOverride = null) => {
    setIsLoading(true);
    setError(null);

    const activeProfile = profileOverride || profile;
    const activeGoal = goalOverride || goal;

    try {
      const [projRes, driftRes] = await Promise.all([
        clientSimulate({
          profile: activeProfile,
          goal: activeGoal,
          transactions,
          adjustments: currentAdjustments
        }),
        getDrift({
          transactions,
          profile: activeProfile,
          goal: activeGoal
        })
      ]);

      setProjection(projRes);
      setNudges(driftRes.nudges || []);
      setAdjustments(currentAdjustments);
      return { success: true, projection: projRes, nudges: driftRes.nudges };
    } catch (err) {
      setError(err.message || 'Failed to calculate projection');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [profile, goal, transactions, adjustments]);

  // Generate Future You Letter
  const handleGenerateLetter = useCallback(async (selectedLang = 'en') => {
    setIsLoading(true);
    setError(null);

    try {
      // Build summary object from latest projection
      const currentProj = projection || await clientSimulate({ profile, goal, transactions, adjustments });

      const summary = {
        goalName: goal.name || 'Financial Goal',
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        saved: goal.saved,
        monthlyIncome: currentProj.monthlyIncome,
        monthlyFixed: currentProj.monthlyFixed,
        monthlyVariable: currentProj.monthlyVariable,
        monthlyNet: currentProj.monthlyNet,
        whatIfNet: currentProj.whatIfNet,
        shortfallAtTarget: currentProj.shortfallAtTarget,
        goalDateContinue: currentProj.goalDateContinue,
        goalDatePlan: currentProj.goalDatePlan,
        goalDateWhatIf: currentProj.goalDateWhatIf,
        topCategory: currentProj.topOverspend?.category || currentProj.topCategories?.[0]?.category || 'General Spending',
        topOverspendRupeeGap: currentProj.topOverspend?.rupeeGap || 0,
        cutPctNeeded: currentProj.cutPctNeeded || 15,
        lang: selectedLang
      };

      const letterRes = await writeLetter({ summary });
      setLetter(letterRes);
      return { success: true, letter: letterRes };
    } catch (err) {
      setError(err.message || 'Failed to generate letter');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [projection, profile, goal, transactions, adjustments]);

  // "Try with sample data" flow: runs sample raw SMS through real parser as a self-test, then loads sample data
  const handleLoadSampleData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Self-test: run real parser on SAMPLE_RAW_SMS
      const testResult = await parseInput({ text: SAMPLE_RAW_SMS });
      const testCount = testResult?.transactions?.length || 0;

      // Now populate sample state
      setTransactions(SAMPLE_TRANSACTIONS);
      setRules(SAMPLE_RULES);
      setProfile(SAMPLE_PROFILE);
      setGoal(SAMPLE_GOAL);
      setAdjustments([]);
      setUnparsed(testResult?.unparsed || []);
      setLastParseStats({
        discovered: testCount + (testResult?.unparsed?.length || 0),
        parsed: testCount,
        unparsed: testResult?.unparsed?.length || 0
      });

      // Compute recurring and projection
      const recRes = await detectRecurring({ transactions: SAMPLE_TRANSACTIONS });
      setSubscriptions(recRes.subscriptions || []);

      const projRes = await clientSimulate({
        profile: SAMPLE_PROFILE,
        goal: SAMPLE_GOAL,
        transactions: SAMPLE_TRANSACTIONS,
        adjustments: []
      });
      setProjection(projRes);

      const driftRes = await getDrift({
        transactions: SAMPLE_TRANSACTIONS,
        profile: SAMPLE_PROFILE,
        goal: SAMPLE_GOAL
      });
      setNudges(driftRes.nudges || []);

      return { success: true };
    } catch (err) {
      setError(err.message || 'Failed to load sample data');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset Books
  const handleResetBooks = useCallback(() => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    } catch {}

    setTransactions([]);
    setRules([]);
    setSubscriptions([]);
    setProfile(DEFAULT_PROFILE);
    setGoal(DEFAULT_GOAL);
    setAdjustments([]);
    setProjection(null);
    setNudges([]);
    setLetter(null);
    setUnparsed([]);
    setLastParseStats(null);
    setError(null);
    setShowResetModal(false);
    setActiveTab('overview');
  }, []);

  const value = {
    activeTab,
    setActiveTab,
    transactions,
    rules,
    subscriptions,
    profile,
    setProfile,
    goal,
    setGoal,
    adjustments,
    setAdjustments,
    projection,
    nudges,
    letter,
    unparsed,
    lastParseStats,
    isLoading,
    error,
    setError,
    showResetModal,
    setShowResetModal,
    handleParseAndCategorize,
    handleLearnRule,
    handleSimulate,
    handleGenerateLetter,
    handleLoadSampleData,
    handleResetBooks
  };

  return (
    <LedgerContext.Provider value={value}>
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return ctx;
}
