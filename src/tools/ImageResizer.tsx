import React, { useState } from 'react';
import { 
  Download, 
  RotateCcw, 
  ArrowRight, 
  Check, 
  Maximize2, 
  Lock, 
  Unlock, 
  Info,
  FileCheck
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { resizeImage, ResizeResult } from '../services/imageService';
import { getImageDimensions, formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';

interface ImageResizerProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const ImageResizer: React.FC<ImageResizerProps> = ({ onNavigateToTool }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [originalDims, setOriginalDims] = useState<{ width: number; height: number } | null>(null);

  const [width, setWidth] = useState<number>(800);
  const [height, setHeight] = useState<number>(600);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [outputFormat, setOutputFormat] = useState<'auto' | 'image/jpeg' | 'image/png' | 'image/webp'>('auto');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<ResizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    setError(null);
    setResult(null);

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image (JPEG, PNG, or WebP).');
      return;
    }

    try {
      const dims = await getImageDimensions(file);
      setOriginalDims(dims);
      setWidth(dims.width);
      setHeight(dims.height);
      setSelectedFile(file);

      const objectUrl = URL.createObjectURL(file);
      setPreviewSrc(objectUrl);
    } catch {
      setError('Could not decode this image file.');
    }
  };

  const handleWidthChange = (newWidthStr: string) => {
    const newWidth = parseInt(newWidthStr, 10);
    if (isNaN(newWidth)) {
      setWidth(0);
      return;
    }
    setWidth(newWidth);
    if (maintainAspectRatio && originalDims && originalDims.width > 0 && newWidth > 0) {
      const ratio = originalDims.height / originalDims.width;
      setHeight(Math.round(newWidth * ratio));
    }
  };

  const handleHeightChange = (newHeightStr: string) => {
    const newHeight = parseInt(newHeightStr, 10);
    if (isNaN(newHeight)) {
      setHeight(0);
      return;
    }
    setHeight(newHeight);
    if (maintainAspectRatio && originalDims && originalDims.height > 0 && newHeight > 0) {
      const ratio = originalDims.width / originalDims.height;
      setWidth(Math.round(newHeight * ratio));
    }
  };

  const applyScalePercent = (percent: number) => {
    if (!originalDims) return;
    const factor = percent / 100;
    setWidth(Math.round(originalDims.width * factor));
    setHeight(Math.round(originalDims.height * factor));
  };

  const applyPreset = (w: number, h: number) => {
    setMaintainAspectRatio(false);
    setWidth(w);
    setHeight(h);
  };

  const handleResize = async () => {
    if (!selectedFile) return;

    if (width <= 0 || height <= 0) {
      setError('Width and height must be greater than 0.');
      return;
    }

    if (width > 12000 || height > 12000) {
      setError('Maximum supported dimension is 12,000 pixels.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await resizeImage(selectedFile, {
        width,
        height,
        maintainAspectRatio: false, // already computed
        outputFormat,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Resizing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const ext = result.mimeType.split('/')[1] || 'jpg';
    const filename = sanitizeFileName(selectedFile.name, `-${result.width}x${result.height}`, ext);
    downloadBlob(result.blob, filename);
  };

  const handleReset = () => {
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    setSelectedFile(null);
    setPreviewSrc(null);
    setOriginalDims(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Image Resizer
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Scale pixel dimensions accurately for forms, portals, and web publishing. Keep proportions locked to avoid distortion, or enter custom width and height.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && (
        <UploadArea
          accept="image/jpeg,image/png,image/webp,image/jpg"
          allowedExtensions={['jpg', 'jpeg', 'png', 'webp']}
          title="Drop an image here to resize"
          subtitle="Supports JPEG, PNG, and WebP up to 50 MB"
          onFilesSelected={handleFiles}
        />
      )}

      {/* File Selected & Dimension Inputs */}
      {selectedFile && originalDims && !result && !isProcessing && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Preview */}
          <div className="md:col-span-6 bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[#687386] mb-2">
                <span className="font-medium text-[#182230] truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
                <span className="font-mono">{formatBytes(selectedFile.size)}</span>
              </div>
              <div className="w-full h-64 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] flex items-center justify-center p-2 overflow-hidden">
                {previewSrc && (
                  <img
                    src={previewSrc}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-[#687386] px-1">
                <span>Original dimensions:</span>
                <span className="font-semibold text-[#182230]">
                  {originalDims.width} × {originalDims.height} px
                </span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-[#687386] hover:text-[#E05252] flex items-center gap-1.5 self-start mt-4 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Choose different image</span>
            </button>
          </div>

          {/* Controls */}
          <div className="md:col-span-6 bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7EAF0]">
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-[#5278F5]" />
                  <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                    Dimension Settings
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    maintainAspectRatio
                      ? 'bg-[#5278F5]/10 border-[#5278F5]/30 text-[#5278F5]'
                      : 'bg-[#F4F6FA] border-[#E7EAF0] text-[#687386]'
                  }`}
                >
                  {maintainAspectRatio ? (
                    <>
                      <Lock className="w-3 h-3" />
                      <span>Aspect Ratio Locked</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3 h-3" />
                      <span>Unlocked</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Scale Buttons */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-2">
                  Scale Shortcuts
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyScalePercent(pct)}
                      className="py-1 px-2 rounded-lg text-xs font-medium bg-[#F4F6FA] border border-[#E7EAF0] hover:bg-[#E7EAF0] text-[#182230] transition-colors"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimension Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">
                    Width (pixels)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12000"
                    value={width || ''}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    className="w-full h-10 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-sm font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">
                    Height (pixels)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12000"
                    value={height || ''}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    className="w-full h-10 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-sm font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                  />
                </div>
              </div>

              {/* Standard Dimensions Presets */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Standard Portal Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset(600, 600)}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] border border-[#E7EAF0]"
                  >
                    600×600 (US Passport)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(1920, 1080)}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] border border-[#E7EAF0]"
                  >
                    1920×1080 (Full HD)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(1200, 800)}
                    className="text-[11px] px-2.5 py-1 rounded bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] border border-[#E7EAF0]"
                  >
                    1200×800 (Web Standard)
                  </button>
                </div>
              </div>

              {/* Output format */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">
                  Output Format
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                >
                  <option value="auto">Auto (Match original format)</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={handleResize}
                disabled={width <= 0 || height <= 0}
                className="w-full h-11 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Resize Image</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && <ProcessingState message="Scaling image with high-fidelity canvas smoothing..." />}

      {/* Success Result */}
      {result && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Image Resized Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resize another image</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Original Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {originalDims?.width} × {originalDims?.height} px
              </p>
              <span className="text-[11px] text-[#687386] font-mono">{formatBytes(selectedFile.size)}</span>
            </div>

            <div className="bg-[#5278F5]/5 border border-[#5278F5]/20 rounded-lg p-4">
              <span className="text-xs text-[#5278F5] font-medium">New Dimensions</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {result.width} × {result.height} px
              </p>
              <span className="text-[11px] text-[#5278F5] font-mono">{formatBytes(result.fileSize)}</span>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Format</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5 uppercase">
                {result.mimeType.split('/')[1]}
              </p>
              <span className="text-[11px] text-[#24B47E] font-medium">Ready to download</span>
            </div>
          </div>

          {/* Preview */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-[#182230] block mb-2">Output Preview</span>
            <div className="w-full h-72 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] flex items-center justify-center p-3">
              <img src={result.previewUrl} alt="Resized output" className="max-h-full max-w-full object-contain" />
            </div>
          </div>

          {/* Download */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              Dimensions: {result.width} × {result.height} px • {formatBytes(result.fileSize)}
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onNavigateToTool && (
                <button
                  onClick={() => onNavigateToTool('file-checker')}
                  className="px-4 py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#182230] transition-colors flex items-center gap-1.5"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Verify with checker</span>
                </button>
              )}
              <button
                onClick={handleDownload}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
