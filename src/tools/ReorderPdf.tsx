import React, { useState, useEffect } from 'react';
import { 
  ArrowUpDown, 
  ArrowLeft, 
  ArrowRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Trash2, 
  RotateCcw, 
  Download, 
  Check, 
  FileText, 
  GripVertical,
  PlusCircle,
  AlertCircle
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectPdfFile, PdfFileInfo } from '../services/pdfService';
import { loadPdfJsDoc, renderPdfPageThumbnail } from '../services/pdfRenderer';
import { reorderPdfPages } from '../services/pdfReorderService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';
import { 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';

interface PageItem {
  originalPageNumber: number; // 1-based original index
}

interface ReorderPdfProps {
  onNavigateToTool?: (slug: string) => void;
}

export const ReorderPdf: React.FC<ReorderPdfProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfFileInfo | null>(null);
  
  // Current ordered list of pages
  const [pageSequence, setPageSequence] = useState<PageItem[]>([]);
  // List of excluded/deleted original page numbers
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  
  // Thumbnails map: originalPageNumber -> base64 DataURL
  const [thumbnails, setThumbnails] = useState<{ [pageNum: number]: string }>({});
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState<boolean>(false);
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [reorderedBlob, setReorderedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setReorderedBlob(null);
    setPageSequence([]);
    setDeletedPages([]);
    setThumbnails({});

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a valid PDF document.');
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
      setError('This PDF is password-protected. Please remove encryption before reordering.');
      return;
    }

    if (info.pageCount <= 1) {
      setError('This document only contains 1 page. Reordering requires a document with at least 2 pages.');
      return;
    }

    setSelectedFile(file);
    setPdfInfo(info);
    trackFileUpload('reorder_pdf', 'pdf', file.type || 'application/pdf');

    const initialPages: PageItem[] = Array.from({ length: info.pageCount }, (_, i) => ({
      originalPageNumber: i + 1,
    }));
    setPageSequence(initialPages);

    // Load thumbnails
    setIsLoadingThumbnails(true);
    try {
      const pdfJsDoc = await loadPdfJsDoc(file);
      const thumbs: { [p: number]: string } = {};
      for (let p = 1; p <= info.pageCount; p++) {
        thumbs[p] = await renderPdfPageThumbnail(pdfJsDoc, p, 0);
      }
      setThumbnails(thumbs);
    } catch {
      // Thumbnails rendering fallback
    } finally {
      setIsLoadingThumbnails(false);
    }
  };

  // Move page by indices
  const movePage = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= pageSequence.length) return;
    if (toIndex < 0 || toIndex >= pageSequence.length) return;
    if (fromIndex === toIndex) return;

    setPageSequence((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  // Remove page from sequence
  const removePage = (index: number) => {
    if (pageSequence.length <= 1) {
      setError('A PDF document must keep at least one page.');
      return;
    }
    const pageToRemove = pageSequence[index];
    setDeletedPages((prev) => [...prev, pageToRemove.originalPageNumber].sort((a, b) => a - b));
    setPageSequence((prev) => prev.filter((_, i) => i !== index));
  };

  // Restore deleted page
  const restorePage = (pageNum: number) => {
    setDeletedPages((prev) => prev.filter((p) => p !== pageNum));
    setPageSequence((prev) => [...prev, { originalPageNumber: pageNum }]);
  };

  // Reset sequence to original 1..N order
  const resetToOriginal = () => {
    if (!pdfInfo) return;
    const initialPages: PageItem[] = Array.from({ length: pdfInfo.pageCount }, (_, i) => ({
      originalPageNumber: i + 1,
    }));
    setPageSequence(initialPages);
    setDeletedPages([]);
    setError(null);
  };

  // Reverse current sequence
  const reverseSequence = () => {
    setPageSequence((prev) => [...prev].reverse());
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      movePage(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleApplyAndDownload = async () => {
    if (!selectedFile || pageSequence.length === 0) return;
    setIsProcessing(true);
    setError(null);
    trackProcessingStarted('reorder_pdf', 'pdf');

    try {
      const order = pageSequence.map((item) => item.originalPageNumber);
      const blob = await reorderPdfPages(selectedFile, order);
      setReorderedBlob(blob);
      trackProcessingSuccess('reorder_pdf', 'pdf');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder PDF pages.';
      setError(msg);
      trackProcessingFailed('reorder_pdf', 'pdf', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!reorderedBlob || !selectedFile) return;
    const filename = sanitizeFileName(selectedFile.name, '_reordered', 'pdf');
    downloadBlob(reorderedBlob, filename);
    trackFileDownload('reorder_pdf', 'pdf', 'application/pdf');
  };

  const handleResetAll = () => {
    setSelectedFile(null);
    setPdfInfo(null);
    setPageSequence([]);
    setDeletedPages([]);
    setThumbnails({});
    setReorderedBlob(null);
    setError(null);
  };

  const isOrderChanged = () => {
    if (!pdfInfo) return false;
    if (deletedPages.length > 0) return true;
    if (pageSequence.length !== pdfInfo.pageCount) return true;
    return pageSequence.some((p, i) => p.originalPageNumber !== i + 1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Reorder PDF Pages
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Rearrange, reorganize, and remove pages in your PDF documents. Drag and drop page thumbnails or use quick navigation buttons to structure the exact page sequence needed.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="application/pdf,.pdf"
          allowedExtensions={['pdf']}
          title="Drop multi-page PDF here to reorder"
          subtitle="Supports standard and scanned PDF documents with 2 or more pages"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Main Workspace */}
      {selectedFile && pdfInfo && !reorderedBlob && !isProcessing && (
        <div className="space-y-6">
          {/* File summary and Global Actions Toolbar */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                {pdfInfo.name}
              </h3>
              <span className="text-xs text-[#687386]">
                Original: {pdfInfo.pageCount} pages • Current output: {pageSequence.length} pages
                {deletedPages.length > 0 && ` (${deletedPages.length} removed)`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reverseSequence}
                className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-semibold text-[#182230] flex items-center gap-1.5 transition-colors"
                title="Reverse entire page order"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#5278F5]" />
                <span>Reverse Order</span>
              </button>

              <button
                type="button"
                onClick={resetToOriginal}
                disabled={!isOrderChanged()}
                className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#687386] hover:text-[#182230] flex items-center gap-1 disabled:opacity-30"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Order</span>
              </button>

              <button
                onClick={handleResetAll}
                className="text-xs text-[#687386] hover:text-[#E05252] ml-2"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Page Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#687386]">
              <span>Drag pages to rearrange, or use directional arrow controls:</span>
              {isLoadingThumbnails && (
                <span className="animate-pulse text-[#5278F5]">Rendering page previews...</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {pageSequence.map((item, index) => {
                const thumb = thumbnails[item.originalPageNumber];
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={`${item.originalPageNumber}-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-[#FFFFFF] border rounded-xl p-3 flex flex-col justify-between shadow-xs transition-all cursor-grab active:cursor-grabbing ${
                      isDragging
                        ? 'opacity-40 border-dashed border-[#5278F5]'
                        : isDragOver
                        ? 'border-[#5278F5] ring-2 ring-[#5278F5]/20 scale-[1.02]'
                        : 'border-[#E7EAF0] hover:border-[#5278F5]/40'
                    }`}
                  >
                    <div>
                      {/* Card Header: Position & Original Page Number */}
                      <div className="flex items-center justify-between text-xs mb-2">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="w-3.5 h-3.5 text-[#687386] opacity-50 cursor-grab" />
                          <span className="font-bold text-[#182230]">
                            #{index + 1}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#F4F6FA] text-[#687386] font-medium border border-[#E7EAF0]">
                          Orig Pg {item.originalPageNumber}
                        </span>
                      </div>

                      {/* Thumbnail Container */}
                      <div className="w-full h-44 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center p-2 mb-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={`Original Page ${item.originalPageNumber}`}
                            className="max-h-full max-w-full object-contain rounded shadow-xs"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-xs text-[#687386]">
                            <FileText className="w-8 h-8 opacity-40 mb-1" />
                            <span>Page {item.originalPageNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="space-y-1.5 pt-2 border-t border-[#E7EAF0]">
                      {/* Directional Move Buttons */}
                      <div className="grid grid-cols-4 gap-1">
                        <button
                          type="button"
                          onClick={() => movePage(index, 0)}
                          disabled={index === 0}
                          title="Move to First"
                          className="py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] flex items-center justify-center disabled:opacity-20 transition-colors"
                        >
                          <ChevronsLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => movePage(index, index - 1)}
                          disabled={index === 0}
                          title="Move Left"
                          className="py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] flex items-center justify-center disabled:opacity-20 transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => movePage(index, index + 1)}
                          disabled={index === pageSequence.length - 1}
                          title="Move Right"
                          className="py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] flex items-center justify-center disabled:opacity-20 transition-colors"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => movePage(index, pageSequence.length - 1)}
                          disabled={index === pageSequence.length - 1}
                          title="Move to Last"
                          className="py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] flex items-center justify-center disabled:opacity-20 transition-colors"
                        >
                          <ChevronsRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Remove Page Button */}
                      <button
                        type="button"
                        onClick={() => removePage(index)}
                        disabled={pageSequence.length <= 1}
                        className="w-full py-1 rounded border border-transparent hover:border-[#E05252]/20 hover:bg-[#E05252]/5 text-[#E05252] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove Page</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deleted Pages Recovery Bar */}
          {deletedPages.length > 0 && (
            <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#687386]" />
                <span className="text-xs text-[#687386]">
                  {deletedPages.length} removed {deletedPages.length === 1 ? 'page' : 'pages'}:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {deletedPages.map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => restorePage(pageNum)}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F4F6FA] hover:bg-[#5278F5]/10 hover:text-[#5278F5] text-[#182230] border border-[#E7EAF0] flex items-center gap-1 transition-colors"
                      title="Click to restore page to the end of document"
                    >
                      <PlusCircle className="w-3 h-3 text-[#5278F5]" />
                      <span>Page {pageNum}</span>
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-[11px] text-[#687386] italic">
                Click any page tag to restore it
              </span>
            </div>
          )}

          {/* Action Bar */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <span className="text-xs text-[#687386]">
              {isOrderChanged()
                ? `Custom sequence ready: ${pageSequence.length} pages will be compiled in this order.`
                : 'Current order matches the original document.'}
            </span>

            <button
              onClick={handleApplyAndDownload}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span>Save & Download Reordered PDF</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && <ProcessingState message="Compiling new page sequence..." />}

      {/* Result Screen */}
      {reorderedBlob && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                PDF Reordered Successfully
              </span>
            </div>

            <button
              onClick={handleResetAll}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reorder another PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Final Page Count</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {pageSequence.length} Pages
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">New File Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {formatBytes(reorderedBlob.size)}
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Vector Document Quality</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#24B47E] mt-0.5">
                100% Preserved
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              All text streams, fonts, annotations, and form data were losslessly rearranged.
            </span>

            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Reordered PDF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
