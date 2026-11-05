import React, { useState } from 'react';
import { 
  Images, 
  RotateCcw, 
  Download, 
  Archive, 
  Check, 
  FileText, 
  Sliders, 
  ArrowRight,
  Eye,
  Info
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectPdfFile, PdfFileInfo } from '../services/pdfService';
import { loadPdfJsDoc, renderPdfPageToCanvas } from '../services/pdfRenderer';
import { createConvertedZip } from '../services/converterService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';

interface ConvertedImageItem {
  pageNumber: number;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  size: number;
}

interface PdfToImagesProps {
  onNavigateToTool?: (slug: string) => void;
}

export const PdfToImages: React.FC<PdfToImagesProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfFileInfo | null>(null);

  // Settings
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [quality, setQuality] = useState<number>(0.9);
  const [dpi, setDpi] = useState<72 | 150 | 300>(150);
  const [pageSelectionMode, setPageSelectionMode] = useState<'all' | 'selected' | 'range'>('all');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [customRange, setCustomRange] = useState<string>('1-3');

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [convertedImages, setConvertedImages] = useState<ConvertedImageItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setConvertedImages([]);

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }

    setIsProcessing(true);
    setProgressText('Reading PDF metadata...');
    const info = await inspectPdfFile(file);
    setIsProcessing(false);

    if (!info.isValid) {
      setError(info.error || 'Failed to read PDF document.');
      return;
    }

    if (info.isEncrypted) {
      setError('This PDF is encrypted or password-protected. Please unlock it first.');
      return;
    }

    setSelectedFile(file);
    setPdfInfo(info);
    // Default: select all pages
    setSelectedPages(Array.from({ length: info.pageCount }, (_, i) => i + 1));
    setCustomRange(info.pageCount > 1 ? `1-${Math.min(3, info.pageCount)}` : '1');
  };

  const parseRangeString = (str: string, maxPages: number): number[] => {
    const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
    const pagesSet = new Set<number>();

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => parseInt(s.trim(), 10));
        if (!isNaN(startStr) && !isNaN(endStr)) {
          const s = Math.max(1, Math.min(startStr, endStr));
          const e = Math.min(maxPages, Math.max(startStr, endStr));
          for (let p = s; p <= e; p++) pagesSet.add(p);
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPages) pagesSet.add(p);
      }
    }

    return Array.from(pagesSet).sort((a, b) => a - b);
  };

  const handleConvert = async () => {
    if (!selectedFile || !pdfInfo) return;

    let targetPages: number[] = [];
    if (pageSelectionMode === 'all') {
      targetPages = Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1);
    } else if (pageSelectionMode === 'selected') {
      targetPages = selectedPages;
    } else {
      targetPages = parseRangeString(customRange, pdfInfo.pageCount);
    }

    if (targetPages.length === 0) {
      setError('Please select at least one page to convert.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setConvertedImages([]);

    try {
      const pdfJsDoc = await loadPdfJsDoc(selectedFile);
      const results: ConvertedImageItem[] = [];

      for (let i = 0; i < targetPages.length; i++) {
        const pageNum = targetPages[i];
        setProgressText(`Rendering page ${i + 1} of ${targetPages.length} (Page ${pageNum})...`);

        const canvas = await renderPdfPageToCanvas(pdfJsDoc, pageNum, { dpi });

        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
            mime,
            quality
          );
        });

        const previewUrl = URL.createObjectURL(blob);
        results.push({
          pageNumber: pageNum,
          blob,
          previewUrl,
          width: canvas.width,
          height: canvas.height,
          size: blob.size,
        });
      }

      setConvertedImages(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to convert PDF pages to images.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleDownloadSingle = (item: ConvertedImageItem) => {
    if (!selectedFile) return;
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}-page-${item.pageNumber}.${format}`;
    downloadBlob(item.blob, filename);
  };

  const handleDownloadAllZip = async () => {
    if (convertedImages.length === 0 || !selectedFile) return;
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
    const zipFiles = convertedImages.map((img) => ({
      filename: `${baseName}-page-${img.pageNumber}.${format}`,
      blob: img.blob,
    }));

    const zipBlob = await createConvertedZip(zipFiles);
    downloadBlob(zipBlob, `${baseName}-images-${format}.zip`);
  };

  const handleReset = () => {
    convertedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setSelectedFile(null);
    setPdfInfo(null);
    setConvertedImages([]);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          PDF to Images
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Convert PDF pages into high-resolution JPG or PNG images. Select specific pages or entire documents, configure print DPI resolution, and download individually or as a single ZIP archive.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="application/pdf,.pdf"
          allowedExtensions={['pdf']}
          title="Drop PDF file here to extract images"
          subtitle="Supports all multi-page PDF documents"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Settings State */}
      {selectedFile && pdfInfo && convertedImages.length === 0 && !isProcessing && (
        <div className="space-y-6">
          {/* File summary */}
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

          {/* Configuration Card */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Output Format */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-2">
                  Image Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat('jpg')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors ${
                      format === 'jpg'
                        ? 'bg-[#5278F5] text-white border-[#5278F5]'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                    }`}
                  >
                    JPG (Smaller file size)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('png')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors ${
                      format === 'png'
                        ? 'bg-[#5278F5] text-white border-[#5278F5]'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                    }`}
                  >
                    PNG (Lossless clarity)
                  </button>
                </div>
              </div>

              {/* Resolution DPI */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-2">
                  Resolution (DPI)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { dpi: 72, label: '72 DPI' },
                    { dpi: 150, label: '150 DPI' },
                    { dpi: 300, label: '300 DPI' },
                  ].map((item) => (
                    <button
                      key={item.dpi}
                      type="button"
                      onClick={() => setDpi(item.dpi as any)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border text-center transition-colors ${
                        dpi === item.dpi
                          ? 'bg-[#5278F5] text-white border-[#5278F5]'
                          : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quality Slider for JPG */}
            {format === 'jpg' && (
              <div className="p-4 bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#182230]">JPG Quality</span>
                  <span className="font-mono text-[#5278F5] font-semibold">{Math.round(quality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  step="5"
                  value={Math.round(quality * 100)}
                  onChange={(e) => setQuality(Number(e.target.value) / 100)}
                  className="w-full accent-[#5278F5] cursor-pointer"
                />
              </div>
            )}

            {/* Page Selection Mode */}
            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-2">
                Pages to Convert
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setPageSelectionMode('all')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors ${
                    pageSelectionMode === 'all'
                      ? 'bg-[#5278F5] text-white border-[#5278F5]'
                      : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                  }`}
                >
                  All {pdfInfo.pageCount} Pages
                </button>
                <button
                  type="button"
                  onClick={() => setPageSelectionMode('selected')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors ${
                    pageSelectionMode === 'selected'
                      ? 'bg-[#5278F5] text-white border-[#5278F5]'
                      : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                  }`}
                >
                  Select Pages
                </button>
                <button
                  type="button"
                  onClick={() => setPageSelectionMode('range')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors ${
                    pageSelectionMode === 'range'
                      ? 'bg-[#5278F5] text-white border-[#5278F5]'
                      : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                  }`}
                >
                  Custom Range
                </button>
              </div>

              {pageSelectionMode === 'selected' && (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-[#F4F6FA] rounded-xl border border-[#E7EAF0] max-h-48 overflow-y-auto">
                  {Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1).map((p) => {
                    const isSelected = selectedPages.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setSelectedPages((prev) =>
                            prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p].sort((a, b) => a - b)
                          )
                        }
                        className={`h-11 rounded-lg border text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#5278F5] text-white border-[#5278F5]'
                            : 'bg-white text-[#182230] border-[#E7EAF0]'
                        }`}
                      >
                        P. {p}
                      </button>
                    );
                  })}
                </div>
              )}

              {pageSelectionMode === 'range' && (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value)}
                    placeholder="e.g. 1-3, 5"
                    className="w-full h-10 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                  />
                  <span className="text-[11px] text-[#687386]">Enter comma-separated page ranges.</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={handleConvert}
                className="w-full h-11 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Convert to {format.toUpperCase()} Images</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <ProcessingState 
          message="Converting PDF pages to images..." 
          submessage={progressText || "Rendering high-resolution raster buffers..."} 
        />
      )}

      {/* Results View */}
      {convertedImages.length > 0 && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                {convertedImages.length} {convertedImages.length === 1 ? 'Image' : 'Images'} Generated ({format.toUpperCase()} @ {dpi} DPI)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadAllZip}
                className="px-4 py-2 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Download All as ZIP</span>
              </button>

              <button
                onClick={handleReset}
                className="p-2 rounded-lg text-xs font-medium text-[#687386] hover:text-[#5278F5]"
                title="Convert another"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grid of converted image previews */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {convertedImages.map((img) => (
              <div
                key={img.pageNumber}
                className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-3 flex flex-col justify-between shadow-xs hover:border-[#5278F5]/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-[#687386] mb-2">
                    <span className="font-bold text-[#182230]">Page {img.pageNumber}</span>
                    <span className="font-mono">{formatBytes(img.size)}</span>
                  </div>

                  <div className="w-full h-44 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center p-2 mb-2">
                    <img
                      src={img.previewUrl}
                      alt={`Page ${img.pageNumber}`}
                      className="max-h-full max-w-full object-contain rounded"
                    />
                  </div>

                  <p className="text-[11px] text-[#687386] text-center mb-3">
                    {img.width} × {img.height} px • {format.toUpperCase()}
                  </p>
                </div>

                <button
                  onClick={() => handleDownloadSingle(img)}
                  className="w-full py-1.5 px-3 rounded-lg border border-[#E7EAF0] bg-[#FFFFFF] hover:bg-[#F4F6FA] text-xs font-medium text-[#5278F5] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Image</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
