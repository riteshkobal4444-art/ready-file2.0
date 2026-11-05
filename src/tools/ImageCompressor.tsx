import React, { useState } from 'react';
import { 
  Download, 
  RotateCcw, 
  ArrowRight, 
  Check, 
  Sliders, 
  FileCheck, 
  Eye, 
  Sparkles,
  Info
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { compressImage, hasTransparency, CompressionResult } from '../services/imageService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';

interface ImageCompressorProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const ImageCompressor: React.FC<ImageCompressorProps> = ({ onNavigateToTool }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [quality, setQuality] = useState<number>(0.8);
  const [outputFormat, setOutputFormat] = useState<'auto' | 'image/jpeg' | 'image/webp' | 'image/png'>('auto');
  const [hasAlpha, setHasAlpha] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    setError(null);
    setResult(null);

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    try {
      const alpha = await hasTransparency(file);
      setHasAlpha(alpha);
      setSelectedFile(file);

      const objectUrl = URL.createObjectURL(file);
      setPreviewSrc(objectUrl);
    } catch {
      setError('Could not decode the selected image. The file might be corrupted.');
    }
  };

  const handleCompress = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await compressImage(selectedFile, {
        quality,
        outputFormat,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Compression failed. Please try a different quality level or image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const ext = result.mimeType.split('/')[1] || 'jpg';
    const filename = sanitizeFileName(selectedFile.name, '-compressed', ext);
    downloadBlob(result.blob, filename);
  };

  const handleReset = () => {
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    setSelectedFile(null);
    setPreviewSrc(null);
    setResult(null);
    setError(null);
    setQuality(0.8);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Image Compressor
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Shrink image file size directly in your browser while retaining crisp visual quality. Ideal for meeting upload portals, application forms, and website weight limits.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* State 1: Upload */}
      {!selectedFile && (
        <UploadArea
          accept="image/jpeg,image/png,image/webp,image/jpg"
          allowedExtensions={['jpg', 'jpeg', 'png', 'webp']}
          title="Drop an image here to compress"
          subtitle="Supports JPEG, PNG, and WebP up to 50 MB"
          onFilesSelected={handleFiles}
        />
      )}

      {/* State 2: File Selected & Tuning Controls */}
      {selectedFile && !result && !isProcessing && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Preview Card */}
          <div className="md:col-span-6 bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col items-center justify-between">
            <div className="w-full mb-4">
              <div className="flex items-center justify-between text-xs text-[#687386] mb-2">
                <span className="font-medium text-[#182230] truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
                <span className="font-mono">{formatBytes(selectedFile.size)}</span>
              </div>
              <div className="w-full h-64 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center p-2 relative">
                {previewSrc && (
                  <img
                    src={previewSrc}
                    alt="Original preview"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                )}
                {hasAlpha && (
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-medium bg-[#182230]/75 text-white backdrop-blur-sm">
                    Transparent Alpha
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-[#687386] hover:text-[#E05252] flex items-center gap-1.5 self-start transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Choose different image</span>
            </button>
          </div>

          {/* Controls Card */}
          <div className="md:col-span-6 bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E7EAF0]">
                <Sliders className="w-4 h-4 text-[#5278F5]" />
                <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                  Compression Settings
                </h3>
              </div>

              {/* Quality Preset Buttons */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-2">
                  Quality Presets
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'High (85%)', val: 0.85 },
                    { label: 'Medium (70%)', val: 0.7 },
                    { label: 'Max (50%)', val: 0.5 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setQuality(preset.val)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        Math.abs(quality - preset.val) < 0.01
                          ? 'bg-[#5278F5] text-white border-[#5278F5]'
                          : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0] hover:bg-[#E7EAF0]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-[#182230]">Custom Quality Slider</span>
                  <span className="font-mono font-semibold text-[#5278F5]">{Math.round(quality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="95"
                  step="5"
                  value={Math.round(quality * 100)}
                  onChange={(e) => setQuality(Number(e.target.value) / 100)}
                  className="w-full accent-[#5278F5] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[#687386] mt-1">
                  <span>Smallest size</span>
                  <span>Highest fidelity</span>
                </div>
              </div>

              {/* Output Format */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Output Format
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full h-10 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                >
                  <option value="auto">Auto (Match original format)</option>
                  <option value="image/jpeg">JPEG (Universal photo format)</option>
                  <option value="image/webp">WebP (Modern, high compression)</option>
                  <option value="image/png">PNG (Lossless, keeps transparency)</option>
                </select>
                {hasAlpha && outputFormat === 'image/jpeg' && (
                  <p className="mt-1.5 text-[11px] text-[#687386] flex items-center gap-1">
                    <Info className="w-3 h-3 text-[#5278F5]" />
                    JPEG does not support transparency; transparent areas will be white.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={handleCompress}
                className="w-full h-11 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Compress Image</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State 3: Processing */}
      {isProcessing && <ProcessingState message="Compressing image in your browser..." />}

      {/* State 4: Result Success */}
      {result && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Image Compressed Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Compress another</span>
            </button>
          </div>

          {/* Metrics comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Original Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {formatBytes(result.originalSize)}
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Compressed Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {formatBytes(result.compressedSize)}
              </p>
            </div>

            <div className="bg-[#24B47E]/5 border border-[#24B47E]/20 rounded-lg p-4">
              <span className="text-xs text-[#24B47E] font-medium">Reduction</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#24B47E] mt-0.5">
                {result.reductionPercentage > 0 ? `-${result.reductionPercentage}%` : 'Already optimized'}
              </p>
            </div>
          </div>

          {result.reductionPercentage <= 0 && (
            <div className="p-3 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg text-xs text-[#687386]">
              Note: The source image was already heavily compressed or in an efficient format. Re-saving produced a file of similar size. You can reduce the quality slider or scale dimensions in the Image Resizer for a smaller file.
            </div>
          )}

          {/* Preview comparison side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-xs font-semibold text-[#687386] block mb-1.5">Original</span>
              <div className="h-56 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] flex items-center justify-center p-2">
                {previewSrc && (
                  <img src={previewSrc} alt="Original" className="max-h-full max-w-full object-contain" />
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-[#5278F5] block mb-1.5">Compressed Output</span>
              <div className="h-56 bg-[#F4F6FA] rounded-lg border border-[#5278F5]/30 flex items-center justify-center p-2">
                <img src={result.previewUrl} alt="Compressed" className="max-h-full max-w-full object-contain" />
              </div>
            </div>
          </div>

          {/* Download Action */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-[#687386]">
              Dimensions: {result.width} × {result.height} px
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onNavigateToTool && (
                <button
                  onClick={() => onNavigateToTool('file-checker')}
                  className="px-4 py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#182230] transition-colors flex items-center gap-1.5"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Verify requirements</span>
                </button>
              )}
              <button
                onClick={handleDownload}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Image ({formatBytes(result.compressedSize)})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
