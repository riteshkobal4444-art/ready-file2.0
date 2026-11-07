import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Stamp, 
  Upload, 
  FileText, 
  Type, 
  Image as ImageIcon, 
  Download, 
  ShieldCheck, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  ArrowLeft, 
  RefreshCw, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  Grid, 
  Layers, 
  Check, 
  SlidersHorizontal 
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  WatermarkOptions, 
  WatermarkPageInfo, 
  WatermarkFontFamily, 
  WatermarkPosition, 
  PageSelectionMode 
} from '../types/watermark';
import { 
  inspectAndLoadPdfForWatermark, 
  renderPdfPageToCanvas, 
  applyWatermarkAndExport, 
  shouldWatermarkPage 
} from '../services/pdfWatermarkService';
import { 
  trackToolOpen, 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';
import { formatBytes } from '../utils/fileHelpers';

interface PdfWatermarkProps {
  onNavigateToTool?: (slug: string) => void;
}

const TEXT_PRESETS = [
  'CONFIDENTIAL',
  'DRAFT',
  'SAMPLE',
  'APPROVED',
  'DO NOT COPY',
  'NOT FOR DISTRIBUTION',
];

export const PdfWatermark: React.FC<PdfWatermarkProps> = ({ onNavigateToTool }) => {
  // Screen mode: 'upload' | 'editor' | 'exported'
  const [screenMode, setScreenMode] = useState<'upload' | 'editor' | 'exported'>('upload');

  // Document state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pages, setPages] = useState<WatermarkPageInfo[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cached PDF.js document proxy
  const pdfjsDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Watermark Configuration State
  const [options, setOptions] = useState<WatermarkOptions>({
    type: 'text',
    text: 'CONFIDENTIAL',
    fontSize: 48,
    color: '#DC2626',
    fontFamily: 'HelveticaBold',
    imageDataUrl: null,
    imageScale: 0.45,
    opacity: 0.25,
    rotation: 45,
    position: 'center',
    pageSelection: 'all',
    customPageRange: '',
  });

  // Editor viewport & zoom
  const [zoomScale, setZoomScale] = useState<number>(1.0); // 0.6 to 2.0
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);

  // Hidden image file input
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Export results
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Analytics on mount
  useEffect(() => {
    trackToolOpen('PDF Watermark', 'PDF Tools');
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (exportUrl) URL.revokeObjectURL(exportUrl);
      if (pdfjsDocRef.current) {
        try {
          pdfjsDocRef.current.cleanup();
        } catch {}
      }
    };
  }, [exportUrl]);

  // Render current PDF page directly onto the canvas
  const renderCurrentPage = useCallback(async () => {
    const pdfjsDoc = pdfjsDocRef.current;
    const canvas = pageCanvasRef.current;
    if (!pdfjsDoc || !canvas || pages.length === 0) return;

    setIsRenderingPage(true);
    setErrorMessage(null);

    try {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = 1.35 * zoomScale * dpr;
      await renderPdfPageToCanvas(pdfjsDoc, currentPageIndex + 1, canvas, scale);
    } catch (err: any) {
      console.error('[PDF Watermark] Render error:', err);
      setErrorMessage(`Failed to render PDF page ${currentPageIndex + 1}: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsRenderingPage(false);
    }
  }, [currentPageIndex, zoomScale, pages.length]);

  // Trigger render when editor opens or page index/zoom changes
  useEffect(() => {
    if (screenMode === 'editor' && pdfjsDocRef.current) {
      renderCurrentPage();
    }
  }, [screenMode, currentPageIndex, zoomScale, renderCurrentPage]);

  // Handle PDF file selection & inspection
  const handlePdfFile = async (file: File) => {
    setErrorMessage(null);
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Please select a valid PDF file (.pdf).');
      return;
    }

    if (file.size === 0) {
      setErrorMessage('The selected PDF file is empty (0 bytes).');
      return;
    }

    setIsLoadingPdf(true);
    try {
      trackFileUpload('PDF Watermark', 'PDF Tools', 'application/pdf');
      setSelectedFile(file);
      setFileName(file.name);
      setFileSize(file.size);

      const inspection = await inspectAndLoadPdfForWatermark(file);
      setOriginalBytes(inspection.originalBytes);
      pdfjsDocRef.current = inspection.pdfjsDoc;
      setPageCount(inspection.pageCount);
      setPages(inspection.pages);
      setCurrentPageIndex(0);

      // Transition to editor
      setScreenMode('editor');
    } catch (err: any) {
      trackProcessingFailed('PDF Watermark', 'PDF Tools', err, 'application/pdf');
      setErrorMessage(err?.message || 'Failed to inspect PDF document.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Handle image upload for watermark
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image/png') && !file.type.includes('image/jpeg')) {
      alert('Please upload a PNG or JPEG image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setOptions((prev) => ({
        ...prev,
        type: 'image',
        imageDataUrl: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Export Watermarked PDF
  const handleExport = async () => {
    if (!originalBytes) {
      setErrorMessage('Original PDF document data is missing. Please re-upload.');
      return;
    }

    if (options.type === 'text' && !options.text.trim()) {
      setErrorMessage('Please enter watermark text before exporting.');
      return;
    }

    if (options.type === 'image' && !options.imageDataUrl) {
      setErrorMessage('Please upload a watermark image before exporting.');
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    try {
      trackProcessingStarted('PDF Watermark', 'PDF Tools', 'application/pdf');
      const blob = await applyWatermarkAndExport(originalBytes, options);

      if (!blob || blob.size === 0) {
        throw new Error('Watermark export produced an empty PDF file.');
      }

      const url = URL.createObjectURL(blob);
      setExportBlob(blob);
      setExportUrl(url);
      trackProcessingSuccess('PDF Watermark', 'PDF Tools', 'application/pdf');
      setScreenMode('exported');
    } catch (err: any) {
      console.error('[PDF Watermark] Export error:', err);
      trackProcessingFailed('PDF Watermark', 'PDF Tools', err, 'application/pdf');
      setErrorMessage(err?.message || 'Failed to apply watermark. Please check your settings.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportUrl || !exportBlob) return;
    trackFileDownload('PDF Watermark', 'PDF Tools', 'application/pdf');
    const a = document.createElement('a');
    a.href = exportUrl;
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}-watermarked.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Dimensions of current page preview
  const basePageWidth = pages[currentPageIndex]?.width || 595;
  const basePageHeight = pages[currentPageIndex]?.height || 842;
  const displayWidth = Math.round(basePageWidth * 1.35 * zoomScale);
  const displayHeight = Math.round(basePageHeight * 1.35 * zoomScale);

  // Check if current preview page is targeted by the watermark rule
  const isCurrentPageWatermarked = shouldWatermarkPage(
    currentPageIndex,
    options.pageSelection,
    options.customPageRange,
    pageCount
  );

  return (
    <div className="space-y-6">
      {/* Hidden file input for watermark image */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* ========================================================= */}
      {/* SCREEN 1: UPLOAD SCREEN                                    */}
      {/* ========================================================= */}
      {screenMode === 'upload' && (
        <div className="max-w-4xl mx-auto space-y-8 py-4">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5278F5]/10 border border-[#5278F5]/20 text-[#5278F5] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Add Text & Image Watermarks to Any PDF</span>
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] font-extrabold text-3xl sm:text-4xl text-[#182230] tracking-tight">
              PDF Watermark
            </h1>
            <p className="text-base text-[#687386] max-w-xl mx-auto leading-relaxed">
              Stamp documents with customized text or brand logos. Adjust opacity, angle, size, tile patterns, and page ranges with real-time visual preview.
            </p>
          </div>

          <div className="bg-[#FFFFFF] border-2 border-dashed border-[#C4C5D6] hover:border-[#5278F5] transition-all rounded-2xl p-8 sm:p-12 text-center shadow-xs">
            <input
              type="file"
              id="watermark-pdf-upload"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePdfFile(f);
              }}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center mx-auto mb-5 shadow-xs">
              <Stamp className="w-8 h-8 stroke-[1.8]" />
            </div>

            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mb-2">
              Select or Drop a PDF to Watermark
            </h3>
            <p className="text-xs text-[#687386] max-w-md mx-auto leading-relaxed mb-6">
              Add CONFIDENTIAL, DRAFT, copyright notices, or your company logo across all or selected pages.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <label
                htmlFor="watermark-pdf-upload"
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                {isLoadingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading Document...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Browse PDF File</span>
                  </>
                )}
              </label>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-[#687386]">
              <span>• Vector quality preserved</span>
              <span>• Multi-page document support</span>
              <span>• 100% In-Browser Privacy</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl flex items-start gap-3 text-xs text-[#991B1B]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Error: </span>
                {errorMessage}
              </div>
            </div>
          )}

          <div className="bg-[#FAFBFC] border border-[#E7EAF0] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-[#24B47E]/10 text-[#24B47E] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-xs text-[#182230]">
                  100% In-Browser Privacy
                </h4>
                <p className="text-xs text-[#687386]">
                  Your files are processed on your device. They are not uploaded to our servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 2: CUSTOMIZE & LIVE PREVIEW WORKSPACE              */}
      {/* ========================================================= */}
      {screenMode === 'editor' && (
        <div className="flex flex-col bg-[#FFFFFF] border border-[#E7EAF0] rounded-2xl shadow-sm overflow-hidden min-h-[780px]">
          {/* Top Control Toolbar */}
          <div className="border-b border-[#E7EAF0] bg-[#FFFFFF] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            {/* Left info & Change file */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (confirm('Discard changes and choose another PDF?')) {
                    setScreenMode('upload');
                    setSelectedFile(null);
                    setOriginalBytes(null);
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-[#F4F6FA] text-[#687386] hover:text-[#182230] text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                title="Change File"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Change File</span>
              </button>

              <div className="h-5 w-px bg-[#E7EAF0]" />

              <div className="flex items-center gap-2 text-xs">
                <FileText className="w-4 h-4 text-[#5278F5]" />
                <span className="font-semibold text-[#182230] truncate max-w-[140px] sm:max-w-[240px]">
                  {fileName}
                </span>
                <span className="text-[11px] text-[#8A94A6]">
                  ({pageCount} {pageCount === 1 ? 'page' : 'pages'})
                </span>
              </div>
            </div>

            {/* Right: Zoom & Export CTA */}
            <div className="flex items-center gap-3">
              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center gap-1 bg-[#FAFBFC] p-0.5 rounded-lg border border-[#E7EAF0] text-xs">
                <button
                  onClick={() => setZoomScale((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
                  title="Zoom Out"
                  className="p-1 rounded hover:bg-white text-[#687386] hover:text-[#182230] cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-semibold text-[#182230] px-1.5 w-10 text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale((z) => Math.min(2.0, Math.round((z + 0.15) * 100) / 100))}
                  title="Zoom In"
                  className="p-1 rounded hover:bg-white text-[#687386] hover:text-[#182230] cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomScale(1.0)}
                  title="Fit 100%"
                  className="px-1.5 py-0.5 rounded text-[10px] text-[#687386] hover:bg-white hover:text-[#182230] cursor-pointer"
                >
                  100%
                </button>
              </div>

              {/* Primary Apply & Export Button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying Watermark...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Apply & Export PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main workspace layout */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-[640px]">
            {/* Center: Live Interactive Preview Viewport */}
            <div className="flex-1 bg-[#F4F6FA] overflow-auto p-6 sm:p-8 flex items-center justify-center relative select-none">
              {isRenderingPage && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-2xs flex items-center justify-center z-40">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E7EAF0] rounded-xl shadow-md text-xs font-semibold text-[#5278F5]">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rendering Page {currentPageIndex + 1}...</span>
                  </div>
                </div>
              )}

              {/* Layered Page Container */}
              <div
                style={{
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                }}
                className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#E7EAF0] rounded-sm relative overflow-hidden transition-all duration-75 select-none"
              >
                {/* Layer 1: PDF.js Base PDF Canvas */}
                <canvas
                  ref={pageCanvasRef}
                  className="w-full h-full block absolute inset-0 pointer-events-none"
                />

                {/* Layer 2: Live Real-Time Watermark Overlay Layer */}
                {isCurrentPageWatermarked && (
                  <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden flex items-center justify-center">
                    {options.type === 'text' && options.text.trim() ? (
                      options.position === 'center' ? (
                        <div
                          style={{
                            transform: `rotate(${options.rotation}deg)`,
                            color: options.color,
                            opacity: options.opacity,
                            fontSize: `${Math.round(((options.fontSize || 48) / 595) * displayWidth)}px`,
                            fontFamily:
                              options.fontFamily === 'TimesRoman'
                                ? 'serif'
                                : options.fontFamily === 'Courier'
                                ? 'monospace'
                                : 'sans-serif',
                            fontWeight: options.fontFamily === 'HelveticaBold' ? 'bold' : 'normal',
                          }}
                          className="whitespace-nowrap tracking-wider select-none leading-none text-center"
                        >
                          {options.text}
                        </div>
                      ) : (
                        // Tiled 3x3 repeating grid overlay
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 items-center justify-items-center">
                          {[...Array(9)].map((_, i) => (
                            <div
                              key={i}
                              style={{
                                transform: `rotate(${options.rotation}deg)`,
                                color: options.color,
                                opacity: options.opacity * 0.85,
                                fontSize: `${Math.round(((options.fontSize || 48) * 0.65 / 595) * displayWidth)}px`,
                                fontFamily:
                                  options.fontFamily === 'TimesRoman'
                                    ? 'serif'
                                    : options.fontFamily === 'Courier'
                                    ? 'monospace'
                                    : 'sans-serif',
                                fontWeight: options.fontFamily === 'HelveticaBold' ? 'bold' : 'normal',
                              }}
                              className="whitespace-nowrap tracking-wider select-none leading-none text-center"
                            >
                              {options.text}
                            </div>
                          ))}
                        </div>
                      )
                    ) : options.type === 'image' && options.imageDataUrl ? (
                      options.position === 'center' ? (
                        <div
                          style={{
                            transform: `rotate(${options.rotation}deg)`,
                            opacity: options.opacity,
                            width: `${Math.round(displayWidth * (options.imageScale || 0.45))}px`,
                          }}
                          className="flex items-center justify-center select-none"
                        >
                          <img
                            src={options.imageDataUrl}
                            alt="Watermark Preview"
                            className="w-full h-auto object-contain pointer-events-none"
                          />
                        </div>
                      ) : (
                        // Tiled 3x3 repeating image grid
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 items-center justify-items-center">
                          {[...Array(9)].map((_, i) => (
                            <div
                              key={i}
                              style={{
                                transform: `rotate(${options.rotation}deg)`,
                                opacity: options.opacity * 0.85,
                                width: `${Math.round(displayWidth * (options.imageScale || 0.45) * 0.65)}px`,
                              }}
                              className="flex items-center justify-center select-none"
                            >
                              <img
                                src={options.imageDataUrl!}
                                alt="Watermark Preview"
                                className="w-full h-auto object-contain pointer-events-none"
                              />
                            </div>
                          ))}
                        </div>
                      )
                    ) : null}
                  </div>
                )}
              </div>

              {/* Floating Bottom Pagination Controls */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xs border border-[#E7EAF0] shadow-lg rounded-full px-4 py-1.5 flex items-center gap-3 text-xs z-30">
                <button
                  onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                  disabled={currentPageIndex === 0}
                  className="p-1 rounded-full hover:bg-[#F4F6FA] text-[#182230] disabled:text-[#C4C5D6] cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-[#182230]">
                  Page {currentPageIndex + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setCurrentPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={currentPageIndex === pageCount - 1}
                  className="p-1 rounded-full hover:bg-[#F4F6FA] text-[#182230] disabled:text-[#C4C5D6] cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-[#E7EAF0]" />

                <span className={`text-[11px] font-medium ${isCurrentPageWatermarked ? 'text-[#047857]' : 'text-[#8A94A6]'}`}>
                  {isCurrentPageWatermarked ? '• Watermarked' : '• Excluded'}
                </span>
              </div>
            </div>

            {/* Right: Watermark Customization Panel */}
            <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[#E7EAF0] bg-white p-5 overflow-y-auto space-y-6 shrink-0">
              {/* Type Switcher Tabs */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#687386] mb-2">
                  Watermark Type
                </label>
                <div className="grid grid-cols-2 p-1 bg-[#FAFBFC] border border-[#E7EAF0] rounded-xl text-xs">
                  <button
                    onClick={() => setOptions((prev) => ({ ...prev, type: 'text' }))}
                    className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      options.type === 'text'
                        ? 'bg-white shadow-xs text-[#5278F5]'
                        : 'text-[#687386] hover:text-[#182230]'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" />
                    <span>Text Watermark</span>
                  </button>
                  <button
                    onClick={() => setOptions((prev) => ({ ...prev, type: 'image' }))}
                    className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      options.type === 'image'
                        ? 'bg-white shadow-xs text-[#5278F5]'
                        : 'text-[#687386] hover:text-[#182230]'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Image / Logo</span>
                  </button>
                </div>
              </div>

              {/* Text Watermark Controls */}
              {options.type === 'text' ? (
                <div className="space-y-4">
                  {/* Preset Pills */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#687386] mb-1.5">
                      Quick Presets
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {TEXT_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setOptions((prev) => ({ ...prev, text: preset }))}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                            options.text === preset
                              ? 'bg-[#5278F5]/10 border-[#5278F5]/30 text-[#5278F5]'
                              : 'bg-[#FAFBFC] border-[#E7EAF0] text-[#687386] hover:bg-[#F4F6FA]'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Text Input */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#687386] mb-1">
                      Watermark Text
                    </label>
                    <input
                      type="text"
                      value={options.text}
                      onChange={(e) => setOptions((prev) => ({ ...prev, text: e.target.value }))}
                      placeholder="Enter watermark text..."
                      className="w-full px-3 py-2 border border-[#E7EAF0] rounded-lg text-xs focus:outline-none focus:border-[#5278F5]"
                    />
                  </div>

                  {/* Typography: Font family & Size */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#687386] mb-1">
                        Font Family
                      </label>
                      <select
                        value={options.fontFamily}
                        onChange={(e) =>
                          setOptions((prev) => ({
                            ...prev,
                            fontFamily: e.target.value as WatermarkFontFamily,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 border border-[#E7EAF0] rounded-lg text-xs bg-white focus:outline-none focus:border-[#5278F5] cursor-pointer"
                      >
                        <option value="HelveticaBold">Helvetica Bold</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="TimesRoman">Times New Roman</option>
                        <option value="Courier">Courier</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#687386] mb-1">
                        Font Size: {options.fontSize}pt
                      </label>
                      <input
                        type="range"
                        min={18}
                        max={100}
                        step={2}
                        value={options.fontSize}
                        onChange={(e) =>
                          setOptions((prev) => ({
                            ...prev,
                            fontSize: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-[#5278F5] cursor-pointer mt-1.5"
                      />
                    </div>
                  </div>

                  {/* Color Palette */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#687386] mb-1.5">
                      Color
                    </label>
                    <div className="flex items-center gap-2">
                      {[
                        { hex: '#DC2626', label: 'Red' },
                        { hex: '#687386', label: 'Slate Grey' },
                        { hex: '#1E40AF', label: 'Royal Blue' },
                        { hex: '#047857', label: 'Green' },
                        { hex: '#182230', label: 'Charcoal' },
                        { hex: '#D97706', label: 'Amber' },
                      ].map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => setOptions((prev) => ({ ...prev, color: c.hex }))}
                          title={c.label}
                          style={{ backgroundColor: c.hex }}
                          className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                            options.color === c.hex ? 'ring-2 ring-offset-2 ring-[#5278F5] scale-110' : 'hover:scale-105'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        value={options.color}
                        onChange={(e) => setOptions((prev) => ({ ...prev, color: e.target.value }))}
                        title="Custom Color"
                        className="w-7 h-7 rounded border border-[#E7EAF0] p-0.5 cursor-pointer bg-white"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Image Watermark Controls */
                <div className="space-y-4">
                  {options.imageDataUrl ? (
                    <div className="p-3 border border-[#E7EAF0] rounded-xl bg-[#FAFBFC] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#182230]">Current Logo</span>
                        <button
                          onClick={() => setOptions((prev) => ({ ...prev, imageDataUrl: null }))}
                          className="text-xs text-[#DC2626] hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="h-24 bg-white border border-[#E7EAF0] rounded-lg p-2 flex items-center justify-center">
                        <img
                          src={options.imageDataUrl}
                          alt="Watermark Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <label
                      onClick={() => imageInputRef.current?.click()}
                      className="border-2 border-dashed border-[#C4C5D6] hover:border-[#5278F5] rounded-xl p-6 text-center block cursor-pointer transition-colors bg-[#FAFBFC]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center mx-auto mb-2">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-semibold text-[#182230] mb-0.5">
                        Choose Watermark Image
                      </div>
                      <div className="text-[11px] text-[#687386]">
                        PNG (transparent logo) or JPEG
                      </div>
                    </label>
                  )}

                  {options.imageDataUrl && (
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-[#687386] mb-1">
                        <span>Image Size</span>
                        <span>{Math.round(options.imageScale * 100)}% of page</span>
                      </div>
                      <input
                        type="range"
                        min={0.15}
                        max={0.8}
                        step={0.05}
                        value={options.imageScale}
                        onChange={(e) =>
                          setOptions((prev) => ({
                            ...prev,
                            imageScale: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full accent-[#5278F5] cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Shared Properties: Opacity, Angle, Position, Pages */}
              <div className="pt-4 border-t border-[#E7EAF0] space-y-4">
                {/* Opacity Slider */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#687386] mb-1">
                    <span>Opacity / Transparency</span>
                    <span>{Math.round(options.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    value={options.opacity}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        opacity: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-[#5278F5] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#8A94A6] mt-0.5">
                    <span>Subtle (15%)</span>
                    <span>Balanced (25%)</span>
                    <span>Solid (100%)</span>
                  </div>
                </div>

                {/* Rotation Angle */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#687386] mb-1">
                    <span>Rotation Angle</span>
                    <span>{options.rotation}°</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mb-2 text-xs">
                    {[
                      { deg: 0, label: '0° Horizontal' },
                      { deg: 45, label: '45° Diagonal' },
                      { deg: -45, label: '-45° Inverted' },
                    ].map((item) => (
                      <button
                        key={item.deg}
                        onClick={() => setOptions((prev) => ({ ...prev, rotation: item.deg }))}
                        className={`py-1.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                          options.rotation === item.deg
                            ? 'bg-[#5278F5]/10 border-[#5278F5]/30 text-[#5278F5] font-semibold'
                            : 'bg-[#FAFBFC] border-[#E7EAF0] text-[#687386] hover:bg-[#F4F6FA]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    step={5}
                    value={options.rotation}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        rotation: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full accent-[#5278F5] cursor-pointer"
                  />
                </div>

                {/* Placement Style */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#687386] mb-1.5">
                    Placement Layout
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => setOptions((prev) => ({ ...prev, position: 'center' }))}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        options.position === 'center'
                          ? 'bg-[#5278F5]/10 border-[#5278F5]/30 text-[#5278F5] font-semibold'
                          : 'bg-[#FAFBFC] border-[#E7EAF0] text-[#687386]'
                      }`}
                    >
                      <div className="font-semibold mb-0.5">Centered</div>
                      <div className="text-[10px] text-[#8A94A6]">Single large watermark in page center</div>
                    </button>

                    <button
                      onClick={() => setOptions((prev) => ({ ...prev, position: 'tile' }))}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        options.position === 'tile'
                          ? 'bg-[#5278F5]/10 border-[#5278F5]/30 text-[#5278F5] font-semibold'
                          : 'bg-[#FAFBFC] border-[#E7EAF0] text-[#687386]'
                      }`}
                    >
                      <div className="font-semibold mb-0.5">Tiled Pattern</div>
                      <div className="text-[10px] text-[#8A94A6]">Repeated 3×3 grid across the page</div>
                    </button>
                  </div>
                </div>

                {/* Page Selection Target */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#687386] mb-1.5">
                    Apply To Pages
                  </label>
                  <select
                    value={options.pageSelection}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        pageSelection: e.target.value as PageSelectionMode,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 border border-[#E7EAF0] rounded-lg text-xs bg-white focus:outline-none focus:border-[#5278F5] cursor-pointer mb-2"
                  >
                    <option value="all">All Pages ({pageCount})</option>
                    <option value="first">First Page Only</option>
                    <option value="odd">Odd Pages Only (1, 3, 5...)</option>
                    <option value="even">Even Pages Only (2, 4, 6...)</option>
                    <option value="custom">Custom Page Range</option>
                  </select>

                  {options.pageSelection === 'custom' && (
                    <input
                      type="text"
                      placeholder="e.g. 1-3, 5, 8"
                      value={options.customPageRange}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          customPageRange: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 border border-[#E7EAF0] rounded-lg text-xs focus:outline-none focus:border-[#5278F5]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 3: EXPORTED / DOWNLOAD RESULT SCREEN               */}
      {/* ========================================================= */}
      {screenMode === 'exported' && (
        <div className="max-w-2xl mx-auto space-y-6 py-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#24B47E]/10 text-[#24B47E] flex items-center justify-center mx-auto mb-2 shadow-xs">
            <CheckCircle2 className="w-8 h-8 stroke-[2]" />
          </div>

          <h2 className="font-['Plus_Jakarta_Sans'] font-extrabold text-2xl sm:text-3xl text-[#182230]">
            Your watermarked PDF is ready!
          </h2>
          <p className="text-sm text-[#687386] max-w-md mx-auto leading-relaxed">
            The watermark has been embedded directly into your original document with clean vector preservation.
          </p>

          <div className="bg-white border border-[#E7EAF0] rounded-xl p-5 text-left max-w-md mx-auto shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold text-xs text-[#182230] truncate">
                  {fileName.replace(/\.[^/.]+$/, '')}-watermarked.pdf
                </div>
                <div className="text-[11px] text-[#687386]">
                  {pageCount} {pageCount === 1 ? 'page' : 'pages'} • {options.type === 'text' ? `Text: "${options.text}"` : 'Image Watermark'}
                </div>
              </div>
            </div>

            {exportBlob && (
              <div className="text-[11px] text-[#687386] pt-2 border-t border-[#E7EAF0] flex justify-between">
                <span>Output File Size:</span>
                <span className="font-mono text-[#182230]">{formatBytes(exportBlob.size)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Watermarked PDF</span>
            </button>

            <button
              onClick={() => setScreenMode('editor')}
              className="w-full sm:w-auto px-5 py-3 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#182230] cursor-pointer"
            >
              Return to Editing
            </button>
          </div>

          <div>
            <button
              onClick={() => {
                setScreenMode('upload');
                setSelectedFile(null);
                setOriginalBytes(null);
                setExportBlob(null);
                if (pdfjsDocRef.current) {
                  try {
                    pdfjsDocRef.current.cleanup();
                  } catch {}
                  pdfjsDocRef.current = null;
                }
              }}
              className="text-xs text-[#5278F5] hover:underline font-medium cursor-pointer"
            >
              Watermark Another Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
