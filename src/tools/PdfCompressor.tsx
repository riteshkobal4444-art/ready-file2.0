import React, { useState } from 'react';
import { 
  FileDown, 
  RotateCcw, 
  Download, 
  Check, 
  Sliders, 
  Info, 
  AlertTriangle, 
  FileText, 
  ArrowRight,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectPdfFile, PdfFileInfo } from '../services/pdfService';
import { 
  compressPdf, 
  CompressionPreset, 
  PdfCompressResult 
} from '../services/pdfCompressorService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';
import { 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';

interface PdfCompressorProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const PdfCompressor: React.FC<PdfCompressorProps> = ({ onNavigateToTool }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfFileInfo | null>(null);

  const [preset, setPreset] = useState<CompressionPreset>('recommended');
  const [customQuality, setCustomQuality] = useState<number>(0.7);
  const [customDpi, setCustomDpi] = useState<number>(140);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [result, setResult] = useState<PdfCompressResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setResult(null);

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }

    setIsProcessing(true);
    setProgressText('Inspecting PDF structure...');
    const info = await inspectPdfFile(file);
    setIsProcessing(false);

    if (!info.isValid) {
      setError(info.error || 'Failed to parse PDF document.');
      return;
    }

    if (info.isEncrypted) {
      setError('This PDF is password-protected. Please unlock it before compressing.');
      return;
    }

    setSelectedFile(file);
    setPdfInfo(info);
    trackFileUpload('PDF Compressor', 'PDF Tools', 'application/pdf');
  };

  const handleCompress = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    trackProcessingStarted('PDF Compressor', 'PDF Tools', 'application/pdf');

    let effectiveQuality = 0.72;
    let effectiveDpi = 140;

    if (preset === 'recommended') {
      effectiveQuality = 0.72;
      effectiveDpi = 140;
    } else if (preset === 'high') {
      effectiveQuality = 0.45;
      effectiveDpi = 96;
    } else {
      effectiveQuality = customQuality;
      effectiveDpi = customDpi;
    }

    try {
      const res = await compressPdf(selectedFile, {
        preset,
        quality: effectiveQuality,
        dpi: effectiveDpi,
        onProgress: (current, total) => {
          setProgressText(`Optimizing page ${current} of ${total}...`);
        },
      });

      setResult(res);
      trackProcessingSuccess('PDF Compressor', 'PDF Tools', 'application/pdf');
    } catch (err: unknown) {
      trackProcessingFailed('PDF Compressor', 'PDF Tools', err, 'application/pdf');
      setError(err instanceof Error ? err.message : 'PDF compression failed. The file may be damaged.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const suffix = result.isReductionAchieved ? '_compressed' : '_optimized';
    const filename = sanitizeFileName(selectedFile.name, suffix, 'pdf');
    trackFileDownload('PDF Compressor', 'PDF Tools', 'application/pdf');
    downloadBlob(result.blob, filename);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPdfInfo(null);
    setResult(null);
    setError(null);
    setProgressText('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          PDF Compressor
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Reduce the file size of your PDF documents locally in your browser. Downsamples embedded raster scans and optimizes stream structures without uploading your data to remote cloud servers.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* State 1: Upload */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="application/pdf,.pdf"
          allowedExtensions={['pdf']}
          title="Drop PDF file here to compress"
          subtitle="Supports PDF documents up to 100 MB"
          onFilesSelected={handleFiles}
        />
      )}

      {/* State 2: Compression Mode Selection */}
      {selectedFile && pdfInfo && !result && !isProcessing && (
        <div className="space-y-6">
          {/* File Card */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center font-bold shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230] truncate" title={pdfInfo.name}>
                  {pdfInfo.name}
                </h3>
                <span className="text-xs text-[#687386]">
                  {pdfInfo.pageCount} {pdfInfo.pageCount === 1 ? 'Page' : 'Pages'} • {formatBytes(pdfInfo.size)}
                </span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#E05252] transition-colors shrink-0"
            >
              Choose different PDF
            </button>
          </div>

          {/* Settings Card */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-3">
                Select Compression Level
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Mode A: Recommended */}
                <button
                  type="button"
                  onClick={() => setPreset('recommended')}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    preset === 'recommended'
                      ? 'bg-[#5278F5]/5 border-[#5278F5] shadow-xs'
                      : 'bg-[#F4F6FA] border-[#E7EAF0] hover:bg-[#E7EAF0]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-[#182230]">Recommended</span>
                    {preset === 'recommended' && <span className="w-2 h-2 rounded-full bg-[#5278F5]" />}
                  </div>
                  <p className="text-xs text-[#687386] leading-relaxed">
                    Balanced quality & file size. Standard 140 DPI downsampling ideal for submissions.
                  </p>
                </button>

                {/* Mode B: High */}
                <button
                  type="button"
                  onClick={() => setPreset('high')}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    preset === 'high'
                      ? 'bg-[#5278F5]/5 border-[#5278F5] shadow-xs'
                      : 'bg-[#F4F6FA] border-[#E7EAF0] hover:bg-[#E7EAF0]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-[#182230]">High Compression</span>
                    {preset === 'high' && <span className="w-2 h-2 rounded-full bg-[#5278F5]" />}
                  </div>
                  <p className="text-xs text-[#687386] leading-relaxed">
                    Maximum size reduction (~96 DPI). Best for email attachments with strict caps.
                  </p>
                </button>

                {/* Mode C: Custom */}
                <button
                  type="button"
                  onClick={() => setPreset('custom')}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    preset === 'custom'
                      ? 'bg-[#5278F5]/5 border-[#5278F5] shadow-xs'
                      : 'bg-[#F4F6FA] border-[#E7EAF0] hover:bg-[#E7EAF0]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-[#182230]">Custom Settings</span>
                    {preset === 'custom' && <span className="w-2 h-2 rounded-full bg-[#5278F5]" />}
                  </div>
                  <p className="text-xs text-[#687386] leading-relaxed">
                    Manually adjust image quality percentage and output DPI resolution.
                  </p>
                </button>
              </div>
            </div>

            {/* Custom Settings Drawer */}
            {preset === 'custom' && (
              <div className="p-4 bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[#182230]">Image Quality</span>
                    <span className="font-mono text-[#5278F5] font-semibold">{Math.round(customQuality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="90"
                    step="5"
                    value={Math.round(customQuality * 100)}
                    onChange={(e) => setCustomQuality(Number(e.target.value) / 100)}
                    className="w-full accent-[#5278F5] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[#687386]">
                    <span>Smaller file</span>
                    <span>Higher fidelity</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">
                    Target Resolution
                  </label>
                  <select
                    value={customDpi}
                    onChange={(e) => setCustomDpi(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230]"
                  >
                    <option value={72}>72 DPI (Extreme compression)</option>
                    <option value={96}>96 DPI (Email / Web)</option>
                    <option value={120}>120 DPI (Balanced)</option>
                    <option value={150}>150 DPI (Good print clarity)</option>
                    <option value={200}>200 DPI (High fidelity)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Technical Information Note */}
            <div className="p-3.5 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg text-xs text-[#687386] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#5278F5] shrink-0 mt-0.5" />
              <span>
                <strong>How it works:</strong> PDF optimization selectively recompresses high-resolution embedded images and cleans unused stream objects. If your PDF is already composed purely of lightweight vector text, size reduction may be limited.
              </span>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCompress}
                className="w-full h-11 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Compress PDF Document</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State 3: Processing */}
      {isProcessing && (
        <ProcessingState 
          message="Optimizing PDF document..." 
          submessage={progressText || "Downsampling raster streams and rebuilding object dictionary..."} 
        />
      )}

      {/* State 4: Results Screen */}
      {result && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                {result.isReductionAchieved ? 'PDF Compressed Successfully' : 'Document Already Highly Optimized'}
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Compress another PDF</span>
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Original Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {formatBytes(result.originalSize)}
              </p>
            </div>

            <div className="bg-[#5278F5]/5 border border-[#5278F5]/20 rounded-lg p-4">
              <span className="text-xs text-[#5278F5] font-medium">Compressed Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {formatBytes(result.compressedSize)}
              </p>
            </div>

            <div className="bg-[#24B47E]/5 border border-[#24B47E]/20 rounded-lg p-4">
              <span className="text-xs text-[#24B47E] font-medium">Reduction</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#24B47E] mt-0.5">
                {result.isReductionAchieved ? `-${result.reductionPercentage}%` : 'Already minimal'}
              </p>
              <span className="text-[11px] text-[#687386]">
                {result.isReductionAchieved ? `Saved ${formatBytes(result.spaceSaved)}` : 'Zero bloat detected'}
              </span>
            </div>
          </div>

          {!result.isReductionAchieved && (
            <div className="p-3.5 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg text-xs text-[#687386]">
              Note: This PDF is primarily composed of vector text and fonts without heavy uncompressed photos. To avoid enlarging the file, we provide your original verified document.
            </div>
          )}

          {/* Action */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              {result.pageCount} Pages • {formatBytes(result.compressedSize)}
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onNavigateToTool && (
                <button
                  onClick={() => onNavigateToTool('file-checker')}
                  className="px-4 py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-semibold text-[#182230] transition-colors"
                >
                  Verify size requirements
                </button>
              )}

              <button
                onClick={handleDownload}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Compressed PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
