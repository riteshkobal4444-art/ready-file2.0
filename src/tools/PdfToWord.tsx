import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  RotateCcw, 
  Check, 
  ShieldCheck, 
  ArrowRight,
  FileCheck2,
  FileImage,
  Sparkles,
  Info,
  Sliders,
  ScanText,
  AlertCircle,
  Table as TableIcon,
  Image as ImageIcon,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectPdfFile, PdfFileInfo } from '../services/pdfService';
import { 
  convertPdfToWordHybrid, 
  ConversionProgress, 
  PdfToWordResult 
} from '../services/pdfToWordService';
import { formatBytes, downloadBlob } from '../utils/fileHelpers';
import { 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload,
  trackPdfWordStage1Started,
  trackPdfWordStage1Success,
  trackPdfWordStage1Failed
} from '../utils/analytics';

interface PdfToWordProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const PdfToWord: React.FC<PdfToWordProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfFileInfo | null>(null);

  // Conversion Mode & Options
  const [conversionMode, setConversionMode] = useState<'editable' | 'visual'>('editable');
  const [visualDpi, setVisualDpi] = useState<150 | 200>(150);
  const [useOcr, setUseOcr] = useState<boolean>(false);
  const [scannedDetected, setScannedDetected] = useState<boolean>(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('Reading PDF document...');
  const [result, setResult] = useState<PdfToWordResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setResult(null);
    setScannedDetected(false);
    setUseOcr(false);

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please select an authentic PDF file.');
      return;
    }

    setIsProcessing(true);
    setProgressStatus('Reading PDF document metadata...');
    const info = await inspectPdfFile(file);
    setIsProcessing(false);

    if (!info.isValid) {
      setError(info.error || 'Failed to parse PDF document.');
      return;
    }

    if (info.isEncrypted) {
      setError('This PDF is password-protected. Please unlock or remove password protection before converting.');
      return;
    }

    setSelectedFile(file);
    setPdfInfo(info);
    trackFileUpload('pdf_to_word', 'pdf', file.type || 'application/pdf');
  };

  const handleConvert = async (forceOcr = false) => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setScannedDetected(false);
    trackProcessingStarted('pdf_to_word', 'pdf');
    trackPdfWordStage1Started(pdfInfo?.pageCount || 1, conversionMode);

    try {
      const res = await convertPdfToWordHybrid(selectedFile, {
        mode: conversionMode,
        visualDpi,
        useOcr: forceOcr || useOcr,
        onProgress: (progress: ConversionProgress) => {
          setProgressStatus(progress.message);
        },
      });

      // If editable mode detected scanned PDF without OCR
      if (res.isScanned && !forceOcr && !useOcr) {
        setScannedDetected(true);
        setIsProcessing(false);
        return;
      }

      setResult(res);
      trackProcessingSuccess('pdf_to_word', 'pdf');
      trackPdfWordStage1Success(res.pageCount, res.mode, res.textBlocksCount || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to convert PDF to Word document.';
      setError(msg);
      trackProcessingFailed('pdf_to_word', 'pdf', msg);
      trackPdfWordStage1Failed(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const getOutputFilename = (): string => {
    if (!selectedFile) return 'document-converted.docx';
    const base = selectedFile.name.replace(/\.[^/.]+$/, '');
    const suffix = result?.mode === 'visual' ? '-visual' : result?.mode === 'ocr' ? '-ocr' : '-converted';
    return `${base}${suffix}.docx`;
  };

  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const filename = getOutputFilename();
    downloadBlob(result.blob, filename);
    trackFileDownload(
      'pdf_to_word',
      'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPdfInfo(null);
    setResult(null);
    setError(null);
    setScannedDetected(false);
    setUseOcr(false);
    setIsProcessing(false);
    setProgressStatus('Reading PDF document...');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          PDF to Word Converter
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Convert PDFs into editable Word documents or preserve their original appearance. Choose between editable text extraction with layout reconstruction or high-fidelity visual page preservation.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Step 1: Upload PDF */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="application/pdf,.pdf"
          allowedExtensions={['pdf']}
          title="Drop PDF file here to convert to Word"
          subtitle="Supports text-based and scanned PDF documents up to 50 MB"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Step 2 & 3: Configuration & Mode Selection */}
      {selectedFile && pdfInfo && !result && !isProcessing && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
            {/* File Overview Summary Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E7EAF0]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center font-bold">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                    {selectedFile.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#687386] mt-0.5">
                    <span>{pdfInfo.pageCount} {pdfInfo.pageCount === 1 ? 'Page' : 'Pages'}</span>
                    <span>•</span>
                    <span className="font-mono">{formatBytes(selectedFile.size)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-semibold text-[#687386] hover:text-[#E05252] transition-colors"
              >
                Choose different file
              </button>
            </div>

            {/* Scanned Document Detection Notification */}
            {scannedDetected && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-['Plus_Jakarta_Sans'] font-semibold text-xs text-amber-900">
                      Scanned or Image-Based PDF Detected
                    </h4>
                    <p className="text-xs text-amber-800 leading-relaxed mt-1">
                      This PDF contains flattened page scans with little to no selectable text. Standard text extraction cannot produce an editable Word document without OCR.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConversionMode('visual');
                      setScannedDetected(false);
                      handleConvert(false);
                    }}
                    className="p-3 bg-white border border-amber-300 rounded-lg text-left hover:bg-amber-100/50 transition-colors shadow-xs"
                  >
                    <span className="font-semibold text-xs text-[#182230] block">
                      Switch to Visual-Preservation Mode (Recommended)
                    </span>
                    <span className="text-[11px] text-[#687386] block mt-0.5">
                      Instantly embeds exact high-resolution page scans into a Word document.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUseOcr(true);
                      setScannedDetected(false);
                      handleConvert(true);
                    }}
                    className="p-3 bg-[#5278F5] text-white rounded-lg text-left hover:bg-[#4165DC] transition-colors shadow-xs"
                  >
                    <span className="font-semibold text-xs block">
                      Run In-Browser OCR Recognition
                    </span>
                    <span className="text-[11px] text-white/80 block mt-0.5">
                      Uses Tesseract to optically transcribe characters into editable text.
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Conversion Mode Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#182230]">
                Select Conversion Mode
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CARD A: Editable Word */}
                <button
                  type="button"
                  onClick={() => {
                    setConversionMode('editable');
                    setScannedDetected(false);
                  }}
                  className={`p-5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    conversionMode === 'editable'
                      ? 'border-[#5278F5] bg-[#5278F5]/5 ring-1 ring-[#5278F5] shadow-xs'
                      : 'border-[#E7EAF0] hover:border-[#5278F5]/40 hover:bg-[#F4F6FA]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        conversionMode === 'editable' ? 'bg-[#5278F5] text-white' : 'bg-[#F4F6FA] text-[#5278F5]'
                      }`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#5278F5]/10 text-[#5278F5]">
                        Best for editing
                      </span>
                    </div>

                    <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230] mb-1">
                      Editable Word
                    </h4>
                    <p className="text-xs text-[#687386] leading-relaxed">
                      Convert text, paragraphs, headings, and supported formatting into native editable Word content.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5278F5] pt-4 mt-2 border-t border-[#E7EAF0]/60">
                    <Check className="w-3.5 h-3.5" />
                    <span>Selectable text & tables</span>
                  </div>
                </button>

                {/* CARD B: Visual-Preservation Word */}
                <button
                  type="button"
                  onClick={() => {
                    setConversionMode('visual');
                    setScannedDetected(false);
                  }}
                  className={`p-5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    conversionMode === 'visual'
                      ? 'border-[#5278F5] bg-[#5278F5]/5 ring-1 ring-[#5278F5] shadow-xs'
                      : 'border-[#E7EAF0] hover:border-[#5278F5]/40 hover:bg-[#F4F6FA]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        conversionMode === 'visual' ? 'bg-[#5278F5] text-white' : 'bg-[#F4F6FA] text-[#5278F5]'
                      }`}>
                        <FileImage className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#24B47E]/10 text-[#24B47E]">
                        Best for visual accuracy
                      </span>
                    </div>

                    <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230] mb-1">
                      Visual-Preservation Word
                    </h4>
                    <p className="text-xs text-[#687386] leading-relaxed">
                      Keep the original PDF page appearance, graphics, and backgrounds intact inside high-res Word pages.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#24B47E] pt-4 mt-2 border-t border-[#E7EAF0]/60">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Exact layout fidelity</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 3: Mode-Specific Settings */}
            {conversionMode === 'visual' ? (
              <div className="p-4 bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#182230] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#5278F5]" />
                    <span>Visual Rendering Quality</span>
                  </label>
                  <span className="text-[11px] text-[#687386]">
                    Page image resolution
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisualDpi(150)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                      visualDpi === 150
                        ? 'bg-[#5278F5] text-white border-[#5278F5] shadow-xs'
                        : 'bg-white text-[#182230] border-[#E7EAF0] hover:bg-[#F4F6FA]'
                    }`}
                  >
                    <span className="block font-bold">Standard (150 DPI)</span>
                    <span className="text-[10px] opacity-80 font-normal">Recommended • Balanced size</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisualDpi(200)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                      visualDpi === 200
                        ? 'bg-[#5278F5] text-white border-[#5278F5] shadow-xs'
                        : 'bg-white text-[#182230] border-[#E7EAF0] hover:bg-[#F4F6FA]'
                    }`}
                  >
                    <span className="block font-bold">High (200 DPI)</span>
                    <span className="text-[10px] opacity-80 font-normal">Crisper print • Larger file size</span>
                  </button>
                </div>

                <p className="text-[11px] text-[#687386] leading-normal">
                  Standard quality provides sharp text rendering while keeping Word file sizes comfortable for emailing.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-[#182230]">
                  <span>Editable Document Features</span>
                  <span className="text-[#5278F5] font-mono">Native DOCX</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#687386]">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#24B47E]" />
                    <span>Multi-column reading order</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#24B47E]" />
                    <span>Heading hierarchy & typography</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#24B47E]" />
                    <span>Preserves original page orientation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#24B47E]" />
                    <span>Table grid detection</span>
                  </div>
                </div>
              </div>
            )}

            {/* In-Browser Privacy Notice */}
            <div className="p-3.5 bg-[#24B47E]/10 border border-[#24B47E]/20 text-[#182230] rounded-lg text-xs flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#24B47E] shrink-0" />
              <span>
                Your PDF is processed locally in your browser. Your document is not uploaded to our servers.
              </span>
            </div>

            {/* Step 4: Primary Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleConvert(false)}
                className="w-full h-12 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Convert to Word ({conversionMode === 'editable' ? 'Editable' : 'Visual Preservation'})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <ProcessingState
          message={
            conversionMode === 'visual'
              ? 'Rendering high-resolution Word document...'
              : useOcr
              ? 'Extracting text with Optical Character Recognition...'
              : 'Reconstructing editable Word document...'
          }
          submessage={progressStatus}
        />
      )}

      {/* Step 5: Success Screen */}
      {result && selectedFile && !isProcessing && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Success Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#24B47E]/10 text-[#24B47E] flex items-center justify-center">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230]">
                  Your Word document is ready.
                </h3>
                <span className="text-xs text-[#687386]">
                  Successfully converted {result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'} using{' '}
                  <strong>
                    {result.mode === 'visual'
                      ? 'Visual-Preservation Mode'
                      : result.mode === 'ocr'
                      ? 'OCR Mode'
                      : 'Editable Word Mode'}
                  </strong>
                  .
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-[#687386] hover:text-[#5278F5] flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Convert Another PDF</span>
            </button>
          </div>

          {/* Result Metadata Box */}
          <div className="p-4 bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-['Plus_Jakarta_Sans'] font-semibold text-xs sm:text-sm text-[#182230]">
                  {getOutputFilename()}
                </p>
                <p className="text-[11px] text-[#687386]">
                  Word Document (.docx) • {formatBytes(result.blob.size)}
                  {result.mode === 'visual' && result.dpiUsed && (
                    <span> • {result.dpiUsed} DPI fidelity</span>
                  )}
                </p>
              </div>
            </div>

            <span className="text-[11px] font-medium text-[#24B47E] bg-[#24B47E]/10 px-2.5 py-1 rounded-full self-start sm:self-auto border border-[#24B47E]/20">
              {result.mode === 'visual' ? 'Visual Page Preservation' : 'Native Editable Elements'}
            </span>
          </div>

          {/* Stage 1 Document Reconstruction Audit (Editable Mode) */}
          {result.mode === 'editable' && (
            <div className="p-4 bg-white border border-[#E7EAF0] rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#E7EAF0] pb-2.5">
                <h4 className="font-['Plus_Jakarta_Sans'] font-semibold text-xs text-[#182230] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#5278F5]" />
                  <span>Document Reconstruction Audit</span>
                </h4>
                <span className="text-[10px] text-[#24B47E] font-medium bg-[#24B47E]/10 px-2 py-0.5 rounded-full">
                  Stage 1.5 Grid Engine
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-[#F4F6FA] rounded-lg">
                  <span className="text-[10px] text-[#687386] block font-medium">Pages Processed</span>
                  <span className="font-semibold text-[#182230] mt-0.5 block">
                    {result.pageCount} of {result.pageCount}
                  </span>
                </div>

                <div className="p-2.5 bg-[#F4F6FA] rounded-lg">
                  <span className="text-[10px] text-[#687386] block font-medium">Text Blocks</span>
                  <span className="font-semibold text-[#182230] mt-0.5 block">
                    {result.textBlocksAssignedToCells
                      ? `${result.textBlocksAssignedToCells} in cells`
                      : result.textBlocksCount ?? 'Extracted'}
                  </span>
                </div>

                <div className="p-2.5 bg-[#F4F6FA] rounded-lg">
                  <span className="text-[10px] text-[#687386] block font-medium">Tables & Borders</span>
                  <span className="font-semibold text-[#182230] mt-0.5 block">
                    {result.tablesReconstructed ?? 0} {result.tablesReconstructed === 1 ? 'table' : 'tables'}
                    {result.detectedRows ? ` (${result.detectedRows}r × ${result.detectedCols}c)` : ''}
                  </span>
                  {result.verticalBordersPresent && (
                    <span className="text-[9px] text-[#24B47E] block mt-0.5 font-medium">
                      ✓ Vertical & horizontal grid restored
                    </span>
                  )}
                </div>

                <div className="p-2.5 bg-[#F4F6FA] rounded-lg">
                  <span className="text-[10px] text-[#687386] block font-medium">Images & Signatures</span>
                  <span className="font-semibold text-[#182230] mt-0.5 block">
                    {result.imagesInserted ?? 0} inserted
                  </span>
                </div>
              </div>

              {/* Advisory Warnings / Notes */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="mt-2 p-3 bg-amber-50/70 border border-amber-200/60 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Conversion Notes:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                    {result.warnings.map((warn, wIdx) => (
                      <li key={wIdx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Visual Mode Disclaimer Notice */}
          {result.mode === 'visual' && (
            <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Visual-Preservation Notice:</strong> Your Word document contains page images. The page content is not directly editable.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full sm:flex-1 h-12 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Word Document</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto h-12 px-6 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-semibold text-[#182230] transition-colors"
            >
              Convert Another PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
