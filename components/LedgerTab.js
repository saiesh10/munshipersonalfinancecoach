'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLedger } from '@/context/LedgerContext';
import {
  Search,
  Download,
  Filter,
  Check,
  ChevronDown,
  AlertCircle,
  Copy,
  CheckCheck,
  Calendar,
  FileText,
  Building2,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import Card from './ui/Card';
import Button from './ui/Button';
import Segmented from './ui/Segmented';
import Chip from './ui/Chip';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';
import Drawer from './ui/Drawer';
import Popover from './ui/Popover';
import CountUp from './ui/CountUp';
import EmptyState from './ui/EmptyState';
import { TableSkeleton } from './ui/Skeleton';
import { formatRupees, getCategoryColor } from './ui/format';
import { CATEGORIES } from '@/lib/engine/categories';

export default function LedgerTab() {
  const {
    transactions,
    setTransactions,
    rules,
    setRules,
    handleLearnRule,
    isLoading,
    setActiveTab
  } = useLedger();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'debit' | 'credit'
  const [visibleCount, setVisibleCount] = useState(50);

  // Category Edit Popover State
  const [editingTxnId, setEditingTxnId] = useState(null);
  const [catSearch, setCatSearch] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [highlightedRowIds, setHighlightedRowIds] = useState(new Set());

  // Drawer Detail State
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [isCopiedRaw, setIsCopiedRaw] = useState(false);

  // Undo Timer Ref
  const undoTimerRef = useRef(null);

  // Filtered Transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // Type Filter
      if (typeFilter === 'debit' && t.direction !== 'debit') return false;
      if (typeFilter === 'credit' && t.direction !== 'credit') return false;

      // Category Filter
      if (selectedCategories.size > 0 && !selectedCategories.has(t.category)) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMerchant = (t.merchant || '').toLowerCase().includes(q);
        const matchCat = (t.category || '').toLowerCase().includes(q);
        const matchRaw = (t.rawText || '').toLowerCase().includes(q);
        if (!matchMerchant && !matchCat && !matchRaw) return false;
      }

      return true;
    });
  }, [transactions, typeFilter, selectedCategories, searchQuery]);

  // Summary Strip Totals
  const summary = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;

    for (const t of filtered) {
      if (t.direction === 'credit') {
        moneyIn += t.amount || 0;
      } else {
        moneyOut += t.amount || 0;
      }
    }

    return {
      moneyIn,
      moneyOut,
      netLeft: moneyIn - moneyOut
    };
  }, [filtered]);

  // Client-side CSV export
  const handleExportCsv = () => {
    if (filtered.length === 0) return;

    const headers = ['Date', 'Merchant', 'Direction', 'Category', 'Amount (INR)', 'Raw Message'];
    const rows = filtered.map(t => [
      `"${t.date || ''}"`,
      `"${(t.merchant || '').replace(/"/g, '""')}"`,
      `"${t.direction}"`,
      `"${t.category || 'Other'}"`,
      t.amount,
      `"${(t.rawText || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `munshi_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle Category in Filter Popover
  const toggleCategoryFilter = (cat) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Learn Rule & Flash Rows
  const handleSelectCategory = async (txn, newCategory) => {
    if (!newCategory || txn.category === newCategory) {
      setEditingTxnId(null);
      return;
    }

    const previousTxns = [...transactions];
    const previousRules = [...rules];

    setEditingTxnId(null);
    setCatSearch('');
    setNewCatInput('');

    const res = await handleLearnRule(txn, newCategory);

    if (res.success) {
      const targetKey = txn.merchantKey;
      const count = res.affectedCount || 0;

      // Flash highlight on affected rows for 1.2s
      const affected = new Set(
        transactions.filter(t => t.merchantKey === targetKey).map(t => t.id)
      );
      setHighlightedRowIds(affected);
      setTimeout(() => setHighlightedRowIds(new Set()), 1200);

      // Sonner Toast with 8s Undo
      toast.success(`Learned: ${txn.merchant} is ${newCategory}. Updated ${count} more ${count === 1 ? 'row' : 'rows'}.`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => {
            setTransactions(previousTxns);
            setRules(previousRules);
            toast('Reverted categorization changes');
          }
        }
      });
    }
  };

  // Copy raw message in drawer
  const handleCopyRaw = (text) => {
    navigator.clipboard.writeText(text);
    setIsCopiedRaw(true);
    setTimeout(() => setIsCopiedRaw(false), 2000);
  };

  // Mini list of other transactions for the drawer
  const otherMerchantTxns = useMemo(() => {
    if (!selectedTxn) return [];
    return transactions
      .filter(t => t.id !== selectedTxn.id && t.merchantKey === selectedTxn.merchantKey)
      .slice(0, 5);
  }, [selectedTxn, transactions]);

  // Categories list for popover
  const filteredCategoriesList = useMemo(() => {
    if (!catSearch.trim()) return CATEGORIES;
    return CATEGORIES.filter(c => c.toLowerCase().includes(catSearch.toLowerCase()));
  }, [catSearch]);

  const pagedTransactions = filtered.slice(0, visibleCount);

  if (transactions.length === 0 && !isLoading) {
    return (
      <div className="py-12">
        <EmptyState
          title="The ledger is empty"
          description="Bring your bank messages or statements on the Paste tab to start tracking."
          primaryAction={{
            label: 'Go to Paste',
            onClick: () => setActiveTab('paste')
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full pb-16">
      {/* Editorial Headline */}
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[28px] font-normal text-ink leading-tight">
          The Books.
        </h2>
        <p className="text-[14px] text-muted">
          Every rupee accounted for. Fix a category once, and Munshi remembers it across every transaction.
        </p>
      </div>

      {/* Summary Strip: Three Compact Cards with Count-up */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[12px] font-medium text-muted block mb-0.5">Money in</span>
            <div className="text-[22px] font-semibold text-success tabular-nums">
              <CountUp value={summary.moneyIn} prefix="₹" />
            </div>
          </div>
          <span className="text-[12px] font-medium text-success bg-primary-tint px-2 py-0.5 rounded-full">
            Credits
          </span>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[12px] font-medium text-muted block mb-0.5">Money out</span>
            <div className="text-[22px] font-semibold text-ink tabular-nums">
              <CountUp value={summary.moneyOut} prefix="₹" />
            </div>
          </div>
          <span className="text-[12px] font-medium text-muted bg-canvas px-2 py-0.5 rounded-full">
            Debits
          </span>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[12px] font-medium text-muted block mb-0.5">Net left</span>
            <div className={`text-[22px] font-semibold tabular-nums ${summary.netLeft >= 0 ? 'text-ink' : 'text-danger'}`}>
              <CountUp value={summary.netLeft} prefix="₹" />
            </div>
          </div>
          <span className="text-[12px] font-medium text-primary bg-primary-tint px-2 py-0.5 rounded-full">
            Margin
          </span>
        </Card>
      </div>

      {/* Sticky Toolbar */}
      <Card className="p-3 sticky top-16 z-20 backdrop-blur-md bg-surface/95 flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Search + Category Filter */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none stroke-[1.75]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchant, category, or note..."
              className="w-full bg-canvas border border-border rounded-control h-9 pl-9 pr-3 text-[13px] text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          {/* Category Multi-Filter Popover */}
          <Popover
            trigger={
              <Button variant="outline" size="sm" icon={Filter}>
                <span>Category</span>
                {selectedCategories.size > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                    {selectedCategories.size}
                  </span>
                )}
              </Button>
            }
          >
            {() => (
              <div className="w-64 max-h-72 overflow-y-auto no-scrollbar p-1 space-y-1">
                <div className="flex items-center justify-between px-2 py-1 text-[12px] font-semibold text-muted border-b border-border">
                  <span>Filter categories</span>
                  {selectedCategories.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(new Set())}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {CATEGORIES.map((cat) => {
                  const isChecked = selectedCategories.has(cat);
                  const color = getCategoryColor(cat);
                  return (
                    <label
                      key={cat}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-control text-[13px] text-ink hover:bg-canvas cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategoryFilter(cat)}
                        className="rounded accent-primary w-4 h-4"
                      />
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate">{cat}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Popover>
        </div>

        {/* Right Side: Type Filter + Export CSV */}
        <div className="flex items-center gap-2">
          <Segmented
            size="sm"
            options={[
              { value: 'all', label: 'All' },
              { value: 'debit', label: 'Money out' },
              { value: 'credit', label: 'Money in' }
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            name="ledger-type"
          />

          <Button
            variant="ghost"
            size="sm"
            icon={Download}
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Transactions Table Card */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[14px] text-muted">No transactions match your search or filters.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategories(new Set());
                setTypeFilter('all');
              }}
            >
              Reset filters
            </Button>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-canvas/50 text-[12px] font-medium text-muted uppercase tracking-wider">
                  <th className="py-2.5 px-4">Merchant &amp; date</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedTransactions.map((txn) => {
                  const isCredit = txn.direction === 'credit';
                  const isUnsure = txn.category === 'unsure' || txn.categorySource === 'unsure' || txn.category === 'Other';
                  const isHighlighted = highlightedRowIds.has(txn.id);

                  return (
                    <tr
                      key={txn.id}
                      className={`h-[56px] transition-colors duration-150 ${
                        isHighlighted
                          ? 'bg-primary-tint/70'
                          : isUnsure
                          ? 'bg-accent-tint/30 hover:bg-accent-tint/50'
                          : 'hover:bg-canvas/50'
                      }`}
                    >
                      {/* Merchant Avatar + Name + Date */}
                      <td
                        onClick={() => setSelectedTxn(txn)}
                        className="py-2 px-4 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={txn.merchant} category={txn.category} size="md" />
                          <div className="flex flex-col">
                            <span className="text-[14px] font-medium text-ink leading-snug hover:underline">
                              {txn.merchant}
                            </span>
                            <span className="text-[12px] text-muted leading-none">
                              {txn.date ? new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category Chip with Popover Combobox */}
                      <td className="py-2 px-4">
                        <Popover
                          isOpen={editingTxnId === txn.id}
                          onOpenChange={(open) => setEditingTxnId(open ? txn.id : null)}
                          trigger={
                            <div className="flex items-center gap-2">
                              <Chip
                                label={txn.category}
                                category={txn.category}
                                interactive
                                showChevron
                                active={editingTxnId === txn.id}
                              />
                              {isUnsure && (
                                <Badge variant="saffron" dot dotColor="#E8890C">
                                  Needs a category
                                </Badge>
                              )}
                            </div>
                          }
                        >
                          {({ close }) => (
                            <div className="w-64 p-2 flex flex-col gap-2">
                              {/* Search category */}
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                                <input
                                  type="text"
                                  autoFocus
                                  value={catSearch}
                                  onChange={(e) => setCatSearch(e.target.value)}
                                  placeholder="Search or pick category..."
                                  className="w-full bg-canvas border border-border rounded-control h-8 pl-8 pr-2 text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>

                              {/* Category List */}
                              <div className="max-h-52 overflow-y-auto no-scrollbar space-y-0.5">
                                {filteredCategoriesList.map((cat) => {
                                  const color = getCategoryColor(cat);
                                  const isSelected = txn.category === cat;
                                  return (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => handleSelectCategory(txn, cat)}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-control text-[13px] text-left transition-colors cursor-pointer ${
                                        isSelected ? 'bg-primary-tint text-primary font-semibold' : 'hover:bg-canvas text-ink'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                        <span className="truncate">{cat}</span>
                                      </div>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Create a category option */}
                              <div className="pt-2 border-t border-border flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={newCatInput}
                                  onChange={(e) => setNewCatInput(e.target.value)}
                                  placeholder="New category..."
                                  className="flex-1 bg-canvas border border-border rounded-control h-7 px-2 text-[12px] text-ink focus:outline-none"
                                />
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={!newCatInput.trim()}
                                  onClick={() => handleSelectCategory(txn, newCatInput.trim())}
                                  className="h-7 px-2 text-[11px]"
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          )}
                        </Popover>
                      </td>

                      {/* Right-aligned Amount */}
                      <td
                        onClick={() => setSelectedTxn(txn)}
                        className="py-2 px-4 text-right cursor-pointer"
                      >
                        <span
                          className={`text-[15px] font-semibold tabular-nums ${
                            isCredit ? 'text-success' : 'text-ink'
                          }`}
                        >
                          {formatRupees(txn.amount, { showPlus: isCredit })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Strip (50 per page) */}
        {filtered.length > visibleCount && (
          <div className="p-4 border-t border-border flex items-center justify-center bg-canvas/30">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((prev) => prev + 50)}
            >
              Show more ({filtered.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </Card>

      {/* Right-Hand Drawer for Transaction Details */}
      <Drawer
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
        title={selectedTxn?.merchant || 'Transaction details'}
        subtitle="Full statement entry and audit trail"
      >
        {selectedTxn && (
          <div className="flex flex-col gap-6">
            {/* Amount Banner */}
            <div className="p-4 bg-canvas rounded-card border border-border flex items-center justify-between">
              <div>
                <span className="text-[12px] text-muted block mb-0.5">Amount</span>
                <span className={`text-[24px] font-semibold tabular-nums ${selectedTxn.direction === 'credit' ? 'text-success' : 'text-ink'}`}>
                  {formatRupees(selectedTxn.amount, { showPlus: selectedTxn.direction === 'credit' })}
                </span>
              </div>
              <Badge variant={selectedTxn.direction === 'credit' ? 'success' : 'default'}>
                {selectedTxn.direction === 'credit' ? 'Credit / Income' : 'Debit / Outflow'}
              </Badge>
            </div>

            {/* Metadata Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[13px] py-1 border-b border-border">
                <span className="text-muted flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Date
                </span>
                <span className="font-medium text-ink">
                  {selectedTxn.date ? new Date(selectedTxn.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px] py-1 border-b border-border">
                <span className="text-muted flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Category
                </span>
                <Chip label={selectedTxn.category} category={selectedTxn.category} />
              </div>

              <div className="flex items-center justify-between text-[13px] py-1 border-b border-border">
                <span className="text-muted flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Source
                </span>
                <span className="font-medium text-ink capitalize">
                  {selectedTxn.categorySource || 'keyword'}
                </span>
              </div>
            </div>

            {/* Original SMS / Message */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-muted" /> Original message
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyRaw(selectedTxn.rawText || '')}
                  className="text-[12px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isCopiedRaw ? <CheckCheck className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedRaw ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-3 bg-canvas border border-border rounded-control font-mono text-[12px] text-ink leading-relaxed break-words">
                {selectedTxn.rawText || 'No raw string available.'}
              </div>
            </div>

            {/* Mini List: Other transactions from this merchant */}
            {otherMerchantTxns.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <span className="text-[13px] font-medium text-ink">
                  Other transactions from {selectedTxn.merchant}
                </span>

                <div className="divide-y divide-border border border-border rounded-control overflow-hidden">
                  {otherMerchantTxns.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTxn(t)}
                      className="p-2.5 bg-surface hover:bg-canvas flex items-center justify-between text-[13px] cursor-pointer transition-colors"
                    >
                      <span className="text-muted">{t.date}</span>
                      <span className="font-medium text-ink tabular-nums">
                        {formatRupees(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
