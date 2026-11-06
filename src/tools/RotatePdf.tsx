import React, { useState, useEffect } from 'react';
import { 
  RotateCw, 
  RotateCcw, 
  Download, 
  Check, 
  FileText, 
  RotateCcw as ResetIcon,
  ArrowRight,
  Info
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectPdfFile, PdfFileInfo } from '../services/pdfService';
import { loadPdfJsDoc, renderPdfPageThumbnail } from '../services/pdfRenderer';
import { applyRotationsToPdf, PageRotationMap } from '../services/pdfRotateService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';
import { 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';

export const RotatePdf: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfFileInfo | null>(null);

  // Map of pageNumber (1-based) -> additional rotation (0, 90, 180, 270)
  const [rotations, setRotations] = useState<PageRotationMap>({});
  // Page thumbnails: pageNumber -> base64 DataURL
  const [thumbnails, setThumbnails] = useState<{ [pageNum: number]: string }>({});

  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [rotatedBlob, setRotatedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setRotatedBlob(null);
    setRotations({});
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
      setError('This PDF is password-protected. Please remove password encryption before rotating.');
      return;
    }

    setSelectedFile(file);
    setPdfInfo(info);
    trackFileUpload('rotate_pdf', 'pdf', file.type || 'application/pdf');

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
      // Thumbnails could not render completely
    } finally {
      setIsLoadingThumbnails(false);
    }
  };

  const rotatePage = (pageNum: number, delta: number) => {
    setRotations((prev) => {
      const current = prev[pageNum] || 0;
      const next = (((current + delta) % 360) + 360) % 360;
      return { ...prev, [pageNum]: next };
    });
  };

  const rotateAllPages = (delta: number) => {
    if (!pdfInfo) return;
    setRotations((prev) => {
      const updated: PageRotationMap = {};
      for (let p = 1; p <= pdfInfo.pageCount; p++) {
        const current = prev[p] || 0;
        updated[p] = (((current + delta) % 360) + 360) % 360;
      }
      return updated;
    });
  };

  const resetAllRotations = () => {
    setRotations({});
  };

  const handleApplyAndDownload = async () => {
    if (!selectedFile || !pdfInfo) return;
    setIsProcessing(true);
    setError(null);
    trackProcessingStarted('rotate_pdf', 'pdf');

    try {
      const blob = await applyRotationsToPdf(selectedFile, rotations);
      setRotatedBlob(blob);
      trackProcessingSuccess('rotate_pdf', 'pdf');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply rotations to PDF.';
      setError(msg);
      trackProcessingFailed('rotate_pdf', 'pdf', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!rotatedBlob || !selectedFile) return;
    const filename = sanitizeFileName(selectedFile.name, '_rotated', 'pdf');
    downloadBlob(rotatedBlob, filename);
    trackFileDownload('rotate_pdf', 'pdf', 'application/pdf');
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPdfInfo(null);
    setRotations({});
    setThumbnails({});
    setRotatedBlob(null);
    setError(null);
  };

  const totalRotatedCount = Object.values(rotations).filter((deg) => deg !== 0).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Rotate PDF Pages
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Permanently rotate upside-down or sideways pages in your PDF documents. Rotate individual pages or all pages simultaneously with vector preservation.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="application/pdf,.pdf"
          allowedExtensions={['pdf']}
          title="Drop PDF file here to rotate"
          subtitle="Supports single and multi-page PDF files"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Main Rotation Workspace */}
      {selectedFile && pdfInfo && !rotatedBlob && !isProcessing && (
        <div className="space-y-6">
          {/* File summary and Global Rotate Toolbar */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                {pdfInfo.name}
              </h3>
              <span className="text-xs text-[#687386]">
                {pdfInfo.pageCount} Pages • {totalRotatedCount} pages modified
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => rotateAllPages(90)}
                className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-semibold text-[#182230] flex items-center gap-1.5 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#5278F5]" />
                <span>Rotate All (+90°)</span>
              </button>

              <button
                type="button"
                onClick={() => rotateAllPages(-90)}
                className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-semibold text-[#182230] flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#5278F5]" />
                <span>Rotate All (-90°)</span>
              </button>

              <button
                type="button"
                onClick={resetAllRotations}
                disabled={totalRotatedCount === 0}
                className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#687386] hover:text-[#182230] flex items-center gap-1 disabled:opacity-30"
              >
                <ResetIcon className="w-3 h-3" />
                <span>Reset</span>
              </button>

              <button
                onClick={handleReset}
                className="text-xs text-[#687386] hover:text-[#E05252] ml-2"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Page Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#687386]">
              <span>Click rotate controls on individual page tiles:</span>
              {isLoadingThumbnails && <span className="animate-pulse text-[#5278F5]">Rendering page previews...</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1).map((pageNum) => {
                const deg = rotations[pageNum] || 0;
                const thumb = thumbnails[pageNum];

                return (
                  <div
                    key={pageNum}
                    className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-3 flex flex-col justify-between shadow-xs hover:border-[#5278F5]/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#687386] mb-2">
                        <span className="font-bold text-[#182230]">Page {pageNum}</span>
                        {deg !== 0 ? (
                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-[#5278F5]/10 text-[#5278F5] font-bold">
                            +{deg}°
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#687386]">0°</span>
                        )}
                      </div>

                      {/* Thumbnail container with live CSS rotation preview */}
                      <div className="w-full h-48 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center p-2 mb-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={`Page ${pageNum}`}
                            style={{
                              transform: `rotate(${deg}deg)`,
                              transition: 'transform 0.2s ease',
                              maxWidth: deg % 180 !== 0 ? '65%' : '90%',
                              maxHeight: deg % 180 !== 0 ? '65%' : '90%',
                            }}
                            className="object-contain rounded"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-xs text-[#687386]">
                            <FileText className="w-8 h-8 opacity-40 mb-1" />
                            <span>Page {pageNum}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Per-page rotation buttons */}
                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#E7EAF0]">
                      <button
                        type="button"
                        onClick={() => rotatePage(pageNum, -90)}
                        className="py-1 px-2 rounded-lg bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-semibold text-[#182230] flex items-center justify-center gap-1 transition-colors"
                        title="Rotate -90°"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#5278F5]" />
                        <span>-90°</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => rotatePage(pageNum, 90)}
                        className="py-1 px-2 rounded-lg bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-semibold text-[#182230] flex items-center justify-center gap-1 transition-colors"
                        title="Rotate +90°"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-[#5278F5]" />
                        <span>+90°</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save Action */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <span className="text-xs text-[#687386]">
              {totalRotatedCount > 0
                ? `${totalRotatedCount} pages will have new permanent orientations saved.`
                : 'No rotation adjustments made yet.'}
            </span>

            <button
              onClick={handleApplyAndDownload}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span>Apply Rotations & Save PDF</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && <ProcessingState message="Saving permanent page orientation vectors..." />}

      {/* Result Screen */}
      {rotatedBlob && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                PDF Rotated Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rotate another PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Pages Modified</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {totalRotatedCount} {totalRotatedCount === 1 ? 'Page' : 'Pages'}
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">File Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {formatBytes(rotatedBlob.size)}
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Format Integrity</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#24B47E] mt-0.5">
                Lossless Vector
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              All original text, fonts, and hyperlinks remain selectable.
            </span>

            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Rotated PDF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
