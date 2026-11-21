'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useLedger } from '@/context/LedgerContext';
import {
  ScanText,
  UploadCloud,
  FileSpreadsheet,
  MessageSquare,
  Smartphone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import Card, { CardHeader } from './ui/Card';
import Button from './ui/Button';
import Segmented from './ui/Segmented';
import Badge from './ui/Badge';
import { SAMPLE_RAW_SMS } from '@/lib/mock/sampleData';

const DEFAULT_SAMPLE_TEXT = `Rs 499.00 debited from A/C XX4102 on 12-Nov-26 to NETFLIX MUMBAI. Ref 631728192831. Bal Rs 41,200.00 - HDFC Bank
Paid Rs 340.00 to SWIGGY via UPI on 14-Nov-26. Ref 631892182912 - ICICI Bank`;

export default function PasteTab() {
  const {
    handleParseAndCategorize,
    handleLoadSampleData,
    lastParseStats,
    unparsed,
    isLoading,
    error,
    setActiveTab
  } = useLedger();

  const [activeSegment, setActiveSegment] = useState('text'); // 'text' | 'file'
  const [inputText, setInputText] = useState(DEFAULT_SAMPLE_TEXT);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [showUnparsedList, setShowUnparsedList] = useState(false);
  const [readingStep, setReadingStep] = useState(0); // 0: idle, 1: reading, 2: sorting, 3: subscriptions

  const fileInputRef = useRef(null);

  // Client-side live message detection: count rupee patterns / debit / credit indicators
  const detectedCount = useMemo(() => {
    if (!inputText.trim()) return 0;
    const matches = inputText.match(/(?:Rs\.?|INR|₹|debited|credited|spent|paid|sent)\s*[0-9,]+/gi);
    return matches ? matches.length : (inputText.trim().split('\n').filter(Boolean).length);
  }, [inputText]);

  // Handle Drag & Drop
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    setUploadedFile({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB'
    });

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target?.result || '');
    };
    reader.readAsText(file);
  };

  const removeFile = () => {
    setUploadedFile(null);
    setFileContent('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Real await step progress execution
  const handleExecuteRead = async () => {
    if (activeSegment === 'text' && !inputText.trim()) return;
    if (activeSegment === 'file' && !fileContent.trim()) return;

    setReadingStep(1); // 1. Reading messages
    try {
      const stepTimer1 = setTimeout(() => setReadingStep(2), 250);
      const stepTimer2 = setTimeout(() => setReadingStep(3), 500);

      const isCsv = uploadedFile?.name?.toLowerCase().endsWith('.csv');

      await handleParseAndCategorize({
        text: activeSegment === 'text' ? inputText : (!isCsv ? fileContent : undefined),
        csv: activeSegment === 'file' ? fileContent : undefined
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setReadingStep(0);
    } catch {
      setReadingStep(0);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* Editorial Headline */}
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-[28px] font-normal text-ink leading-tight">
          Bring your mess.
        </h2>
        <p className="text-[14px] text-muted">
          Paste whatever your bank sent you. Munshi extracts the amounts, cleans merchant names, and handles the rest.
        </p>
      </div>

      {/* Inline Danger Alert */}
      {error && (
        <div className="bg-danger-tint border border-danger/30 rounded-card p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-[14px] font-semibold text-danger">Could not read input</h4>
            <p className="text-[13px] text-ink mt-0.5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExecuteRead}>
            Retry
          </Button>
        </div>
      )}

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Card (7 cols) */}
        <Card className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Segmented
              options={[
                { value: 'text', label: 'Paste texts' },
                { value: 'file', label: 'Upload file' }
              ]}
              value={activeSegment}
              onChange={setActiveSegment}
              name="paste-mode"
            />

            {activeSegment === 'text' && (
              <span className="text-[13px] text-muted flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>{detectedCount} {detectedCount === 1 ? 'message' : 'messages'} detected</span>
              </span>
            )}
          </div>

          {/* Paste Text Tab */}
          {activeSegment === 'text' && (
            <div className="flex flex-col gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={9}
                placeholder="Paste SMS messages, UPI debit notifications, or copied email receipts here..."
                className="w-full bg-surface border border-border rounded-control p-3.5 text-[15px] text-ink placeholder:text-muted/60 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all font-mono"
              />
            </div>
          )}

          {/* Upload CSV Tab */}
          {activeSegment === 'file' && (
            <div className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv,text/csv,text/plain"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!uploadedFile ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-control p-8 flex flex-col items-center justify-center gap-2 hover:bg-canvas transition-colors cursor-pointer text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-muted">
                    <UploadCloud className="w-5 h-5 stroke-[1.75]" />
                  </div>
                  <div>
                    <span className="text-[14px] font-medium text-ink">Drop a CSV or message file here or browse</span>
                    <p className="text-[12px] text-muted mt-0.5">Supports bank statements and SMS message exports (.csv, .txt)</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-canvas border border-border rounded-control flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-6 h-6 text-primary shrink-0" />
                    <div>
                      <span className="text-[14px] font-medium text-ink block leading-snug">{uploadedFile.name}</span>
                      <span className="text-[12px] text-muted">{uploadedFile.size}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1.5 rounded-control text-muted hover:text-danger hover:bg-danger-tint transition-colors cursor-pointer"
                    aria-label="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Real Await 3-step Progress Indicator */}
          {readingStep > 0 && (
            <div className="p-4 bg-primary-tint border border-primary/20 rounded-control flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-primary">
                <Loader2 className="w-4 h-4 animate-spin stroke-[2]" />
                <span>Munshi is processing your statements...</span>
              </div>
              <div className="space-y-1.5 pl-6 text-[13px]">
                <div className={`flex items-center gap-2 ${readingStep >= 1 ? 'text-primary font-medium' : 'text-muted'}`}>
                  <span>1. Reading messages</span>
                  {readingStep > 1 && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                </div>
                <div className={`flex items-center gap-2 ${readingStep >= 2 ? 'text-primary font-medium' : 'text-muted'}`}>
                  <span>2. Sorting into categories</span>
                  {readingStep > 2 && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                </div>
                <div className={`flex items-center gap-2 ${readingStep >= 3 ? 'text-primary font-medium' : 'text-muted'}`}>
                  <span>3. Looking for subscriptions</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Action Strip */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              icon={Database}
              onClick={handleLoadSampleData}
            >
              Use sample data
            </Button>

            <Button
              variant="primary"
              onClick={handleExecuteRead}
              loading={isLoading || readingStep > 0}
              icon={ScanText}
              disabled={(activeSegment === 'text' && !inputText.trim()) || (activeSegment === 'file' && !fileContent.trim())}
            >
              Read my messages
            </Button>
          </div>
        </Card>

        {/* Right Column: Guidance & Privacy Cards (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Supported Formats Card */}
          <Card>
            <CardHeader
              title="What Munshi can read"
              subtitle="Tolerant of bank formats, UPI handles, and messy text"
            />

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-2 rounded-control hover:bg-canvas transition-colors">
                <div className="w-8 h-8 rounded-control bg-primary-tint text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4 stroke-[1.75]" />
                </div>
                <div>
                  <h4 className="text-[14px] font-medium text-ink">Bank SMS</h4>
                  <p className="text-[12px] text-muted leading-relaxed">
                    HDFC, SBI, ICICI, Axis, Kotak debit and credit transaction SMS.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2 rounded-control hover:bg-canvas transition-colors">
                <div className="w-8 h-8 rounded-control bg-accent-tint text-accent-saffron flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4 stroke-[1.75]" />
                </div>
                <div>
                  <h4 className="text-[14px] font-medium text-ink">UPI alerts</h4>
                  <p className="text-[12px] text-muted leading-relaxed">
                    PhonePe, Google Pay, Paytm, BHIM notifications with VPAs.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2 rounded-control hover:bg-canvas transition-colors">
                <div className="w-8 h-8 rounded-control bg-[#EEF5E8] text-[#5B8C3A] flex items-center justify-center shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4 stroke-[1.75]" />
                </div>
                <div>
                  <h4 className="text-[14px] font-medium text-ink">CSV statements</h4>
                  <p className="text-[12px] text-muted leading-relaxed">
                    Downloaded bank statements with preambles and narration columns.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2 rounded-control hover:bg-canvas transition-colors">
                <div className="w-8 h-8 rounded-control bg-[#EBF2F9] text-[#3A6EA5] flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 stroke-[1.75]" />
                </div>
                <div>
                  <h4 className="text-[14px] font-medium text-ink">Copied email alerts</h4>
                  <p className="text-[12px] text-muted leading-relaxed">
                    Card spending confirmations, Netbanking intimations, and receipts.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Privacy Card */}
          <Card className="bg-[#E6F2EC]/40 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-control bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldCheck className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-[14px] font-semibold text-primary">Private by design</h4>
                <p className="text-[13px] text-ink leading-relaxed">
                  We don't store your messages. Your books stay in this browser. Only summary numbers are sent to the AI.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Result Card (When messages have been read) */}
      {lastParseStats && (
        <Card className="border-primary/20 bg-primary-tint/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <h3 className="text-[16px] font-semibold text-ink">
                  Read {lastParseStats.discovered} messages, understood {lastParseStats.parsed}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="success">
                  {lastParseStats.parsed} parsed
                </Badge>
                {lastParseStats.unparsed > 0 && (
                  <Badge variant="saffron">
                    {lastParseStats.unparsed} couldn't be read
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="primary"
              icon={ArrowRight}
              onClick={() => setActiveTab('ledger')}
            >
              Open the ledger
            </Button>
          </div>

          {/* Collapsible Unparsed List */}
          {lastParseStats.unparsed > 0 && unparsed.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowUnparsedList(!showUnparsedList)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-accent-saffron hover:underline cursor-pointer"
              >
                <span>{showUnparsedList ? 'Hide unreadable lines' : `Show the ${lastParseStats.unparsed} unreadable lines`}</span>
                {showUnparsedList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showUnparsedList && (
                <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto no-scrollbar font-mono text-[12px] bg-surface p-3 rounded-control border border-border">
                  {unparsed.map((line, idx) => (
                    <div key={idx} className="p-1.5 bg-canvas rounded-[6px] text-muted truncate">
                      "{line}"
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
