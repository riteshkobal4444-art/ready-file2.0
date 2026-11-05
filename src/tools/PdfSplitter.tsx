import React, { useState } from 'react';
import { 
  Split, 
  RotateCcw, 
  Download, 
  Archive, 
  Check, 
  FileText, 
  Sliders, 
  CheckSquare, 
  Square, 
  ArrowRight,
  Layers,
  Info
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { 
  inspectPdfFile, 
  extractPdfPages, 
  splitPdfEveryPage, 
  splitPdfByRanges, 
  splitPdfGroups, 
  SplitResultFile,
  PdfFileInfo 
} from '../services/pdfService';
import { createConvertedZip } from '../services/converterService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';

interface PdfSplitterProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

type SplitMode = 'extract' | 'ranges' | 'all-individual' | 'equal-groups';

export const PdfSplitter: React.FC<PdfSplitterProps> = ({ onNavigateToTool }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfFileInfo | null>(null);

  const [mode, setMode] = useState<SplitMode>('extract');

  // Mode A: Extract selected pages (1-based indices)
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  // Mode B: Ranges (e.g., "1-2, 3-5")
  const [rangeInput, setRangeInput] = useState<string>('1-2, 3-4');

  // Mode C: Equal groups (e.g., 2 pages per file)
  const [groupSize, setGroupSize] = useState<number>(2);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedBlob, setExtractedBlob] = useState<Blob | null>(null);
  const [splitFiles, setSplitFiles] = useState<SplitResultFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setExtractedBlob(null);
    setSplitFiles([]);

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }

    setIsProcessing(true);
    const info = await inspectPdfFile(file);
    setIsProcessing(false);

    if (!info.isValid) {
      setError(info.error || 'Failed to read PDF document.');
      return;
    }

    if (info.isEncrypted) {
      setError('This PDF is password-protected. Please remove password encryption before splitting.');
      return;
    }

    setSelectedFile(file);
    setPdfInfo(info);
    // Default: select first page or all
    setSelectedPages([1]);
    if (info.pageCount > 1) {
      setRangeInput(`1-${Math.ceil(info.pageCount / 2)}, ${Math.ceil(info.pageCount / 2) + 1}-${info.pageCount}`);
    } else {
      setRangeInput('1');
    }
  };

  const togglePageSelection = (page: number) => {
    setSelectedPages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page].sort((a, b) => a - b)
    );
  };

  const handleSelectAll = () => {
    if (!pdfInfo) return;
    const all = Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1);
    setSelectedPages(all);
  };

  const handleDeselectAll = () => {
    setSelectedPages([]);
  };

  const handleInvertSelection = () => {
    if (!pdfInfo) return;
    const inverted = Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1).filter(
      (p) => !selectedPages.includes(p)
    );
    setSelectedPages(inverted);
  };

  // Parse range string (e.g., "1-3, 5, 7-10")
  const parseRanges = (str: string, maxPages: number): { name: string; pages: number[] }[] => {
    const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
    const groups: { name: string; pages: number[] }[] = [];

    parts.forEach((part, idx) => {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => parseInt(s.trim(), 10));
        if (!isNaN(startStr) && !isNaN(endStr)) {
          const s = Math.max(1, Math.min(startStr, endStr));
          const e = Math.min(maxPages, Math.max(startStr, endStr));
          const pList: number[] = [];
          for (let i = s; i <= e; i++) pList.push(i);
          if (pList.length > 0) {
            groups.push({ name: `pages_${s}-${e}`, pages: pList });
          }
        }
      } else {
        const page = parseInt(part, 10);
        if (!isNaN(page) && page >= 1 && page <= maxPages) {
          groups.push({ name: `page_${page}`, pages: [page] });
        }
      }
    });

    return groups;
  };

  const handleExecuteSplit = async () => {
    if (!selectedFile || !pdfInfo) return;
    setIsProcessing(true);
    setError(null);
    setExtractedBlob(null);
    setSplitFiles([]);

    try {
      if (mode === 'extract') {
        if (selectedPages.length === 0) {
          setError('Please select at least 1 page to extract.');
          setIsProcessing(false);
          return;
        }
        const blob = await extractPdfPages(selectedFile, selectedPages);
        setExtractedBlob(blob);
      } else if (mode === 'all-individual') {
        const results = await splitPdfEveryPage(selectedFile);
        setSplitFiles(results);
      } else if (mode === 'ranges') {
        const groups = parseRanges(rangeInput, pdfInfo.pageCount);
        if (groups.length === 0) {
          setError('Please enter a valid page range (e.g. 1-3, 4-6).');
          setIsProcessing(false);
          return;
        }
        const results = await splitPdfByRanges(selectedFile, groups);
        setSplitFiles(results);
      } else if (mode === 'equal-groups') {
        const results = await splitPdfGroups(selectedFile, groupSize);
        setSplitFiles(results);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PDF splitting failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadExtracted = () => {
    if (!extractedBlob || !selectedFile) return;
    const filename = sanitizeFileName(selectedFile.name, `_extracted_${selectedPages.length}_pages`, 'pdf');
    downloadBlob(extractedBlob, filename);
  };

  const handleDownloadZip = async () => {
    if (splitFiles.length === 0 || !selectedFile) return;
    const zipItems = splitFiles.map((f) => ({ filename: f.name, blob: f.blob }));
    const zipBlob = await createConvertedZip(zipItems);
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
    downloadBlob(zipBlob, `${baseName}_split_files.zip`);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPdfInfo(null);
    setSelectedPages([]);
    setExtractedBlob(null);
    setSplitFiles([]);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          PDF Splitter
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Extract specific pages or divide multi-page PDF documents into smaller files. Choose selected pages, split by custom ranges, or separate every page into a standalone PDF.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="application/pdf,.pdf"
          allowedExtensions={['pdf']}
          title="Drop PDF file here to split"
          subtitle="Upload any multi-page PDF document"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Processing */}
      {isProcessing && <ProcessingState message="Processing PDF pages and generating files..." />}

      {/* Main Splitting Workspace */}
      {selectedFile && pdfInfo && !extractedBlob && splitFiles.length === 0 && !isProcessing && (
        <div className="space-y-6">
          {/* File Overview Card */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                  {pdfInfo.name}
                </h3>
                <span className="text-xs text-[#687386]">
                  {pdfInfo.pageCount} {pdfInfo.pageCount === 1 ? 'Page' : 'Pages'} • {formatBytes(pdfInfo.size)}
                </span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#E05252] transition-colors"
            >
              Choose different PDF
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-2">
                Choose Split Method:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'extract', label: 'Extract Selected Pages' },
                  { id: 'ranges', label: 'Split by Ranges' },
                  { id: 'all-individual', label: 'Every Page Separate' },
                  { id: 'equal-groups', label: 'Equal Page Groups' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMode(t.id as SplitMode)}
                    className={`p-3 rounded-lg text-xs font-semibold border text-center transition-all ${
                      mode === t.id
                        ? 'bg-[#5278F5] text-white border-[#5278F5] shadow-xs'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0] hover:bg-[#E7EAF0]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-mode UI 1: Select Individual Pages */}
            {mode === 'extract' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E7EAF0]">
                  <span className="text-xs font-semibold text-[#182230]">
                    Select pages to include ({selectedPages.length} of {pdfInfo.pageCount} selected):
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2.5 py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230]"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2.5 py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230]"
                    >
                      Deselect All
                    </button>
                    <button
                      type="button"
                      onClick={handleInvertSelection}
                      className="px-2.5 py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230]"
                    >
                      Invert
                    </button>
                  </div>
                </div>

                {/* Page grid tiles */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 max-h-72 overflow-y-auto p-2 bg-[#F4F6FA] rounded-xl border border-[#E7EAF0]">
                  {Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1).map((pageNum) => {
                    const isSelected = selectedPages.includes(pageNum);
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => togglePageSelection(pageNum)}
                        className={`h-20 rounded-lg border flex flex-col items-center justify-center p-2 text-center transition-all ${
                          isSelected
                            ? 'bg-[#5278F5] border-[#5278F5] text-white shadow-xs'
                            : 'bg-[#FFFFFF] border-[#E7EAF0] text-[#182230] hover:border-[#5278F5]/60'
                        }`}
                      >
                        <FileText className="w-5 h-5 mb-1 opacity-80" />
                        <span className="text-xs font-bold">Page {pageNum}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sub-mode UI 2: Ranges */}
            {mode === 'ranges' && (
              <div className="space-y-3 pt-2 border-t border-[#E7EAF0]">
                <label className="block text-xs font-semibold text-[#182230]">
                  Enter Page Ranges (comma separated)
                </label>
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g. 1-2, 3-5, 6"
                  className="w-full h-10 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                />
                <p className="text-[11px] text-[#687386]">
                  Example: "1-3, 4-6" creates two separate PDF files: one containing pages 1 to 3, and another containing pages 4 to 6.
                </p>
              </div>
            )}

            {/* Sub-mode UI 3: Every Page Separate */}
            {mode === 'all-individual' && (
              <div className="pt-2 border-t border-[#E7EAF0] text-xs text-[#687386] space-y-1">
                <p>
                  This will divide your document into <strong>{pdfInfo.pageCount} separate single-page PDF files</strong>.
                </p>
                <p>You will be able to download them individually or as a single ZIP package.</p>
              </div>
            )}

            {/* Sub-mode UI 4: Equal Groups */}
            {mode === 'equal-groups' && (
              <div className="space-y-3 pt-2 border-t border-[#E7EAF0]">
                <label className="block text-xs font-semibold text-[#182230]">
                  Split every N pages into a new document
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max={pdfInfo.pageCount}
                    value={groupSize}
                    onChange={(e) => setGroupSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-28 h-10 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                  />
                  <span className="text-xs text-[#687386]">
                    Pages per document (Will create ~{Math.ceil(pdfInfo.pageCount / (groupSize || 1))} files)
                  </span>
                </div>
              </div>
            )}

            {/* Action Trigger */}
            <div className="pt-4 border-t border-[#E7EAF0]">
              <button
                onClick={handleExecuteSplit}
                className="w-full h-11 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Process and Split PDF</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result State A: Single Extracted PDF */}
      {extractedBlob && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Pages Extracted Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Split another PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Pages Included</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {selectedPages.length} Pages
              </p>
              <span className="text-[11px] text-[#687386]">({selectedPages.join(', ')})</span>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Extracted File Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {formatBytes(extractedBlob.size)}
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Status</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#24B47E] mt-0.5">
                Ready to Download
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              Consolidated into a single clean PDF document.
            </span>
            <button
              onClick={handleDownloadExtracted}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Extracted PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Result State B: Multiple Split PDF Files */}
      {splitFiles.length > 0 && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                {splitFiles.length} PDF Documents Generated
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadZip}
                className="px-4 py-2 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Download All as ZIP</span>
              </button>

              <button
                onClick={handleReset}
                className="p-2 rounded-lg text-xs font-medium text-[#687386] hover:text-[#5278F5]"
                title="Start again"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List of generated split files */}
          <div className="divide-y divide-[#E7EAF0] border border-[#E7EAF0] rounded-xl overflow-hidden max-h-80 overflow-y-auto">
            {splitFiles.map((file, idx) => (
              <div
                key={idx}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F6FA]/50 transition-colors text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center shrink-0 font-bold text-[11px]">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#182230] truncate" title={file.name}>
                      {file.name}
                    </p>
                    <span className="text-[11px] text-[#687386]">
                      {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'} • {formatBytes(file.size)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => downloadBlob(file.blob, file.name)}
                  className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#FFFFFF] hover:bg-[#F4F6FA] text-xs font-medium text-[#5278F5] flex items-center gap-1 transition-colors shrink-0"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
