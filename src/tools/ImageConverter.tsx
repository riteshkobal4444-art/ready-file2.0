import React, { useState } from 'react';
import { 
  RefreshCw, 
  RotateCcw, 
  Download, 
  Trash2, 
  Plus, 
  Check, 
  Sliders, 
  Info, 
  Archive, 
  FileImage,
  AlertCircle
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { 
  convertSingleImage, 
  createConvertedZip, 
  OutputFormat, 
  ConversionItem, 
  isMimeSupported 
} from '../services/converterService';
import { formatBytes, downloadBlob, sanitizeFileName, getFileExtension } from '../utils/fileHelpers';

interface ImageConverterProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const ImageConverter: React.FC<ImageConverterProps> = ({ onNavigateToTool }) => {
  const [items, setItems] = useState<ConversionItem[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('webp');
  const [quality, setQuality] = useState<number>(0.85);

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [hasConverted, setHasConverted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (files: File[]) => {
    setError(null);
    setHasConverted(false);

    const newItems: ConversionItem[] = [];
    for (const file of files) {
      const ext = getFileExtension(file.name);
      const isImg = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif'].includes(ext);

      if (!isImg) {
        continue;
      }

      // Check for unreadable TIFF
      if (ext === 'tiff' || ext === 'tif' || file.type.includes('tiff')) {
        setError('TIFF files are not natively supported by browser canvas decoding. Please use JPEG, PNG, WebP, GIF, BMP, or AVIF.');
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        file,
        previewUrl,
        sourceFormat: ext.toUpperCase() || 'IMG',
        status: 'idle',
      });
    }

    if (newItems.length === 0 && !error) {
      setError('Please select valid image files (JPG, PNG, WebP, GIF, BMP, or AVIF).');
      return;
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        if (target.convertedUrl) URL.revokeObjectURL(target.convertedUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleReset = () => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
      if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
    });
    setItems([]);
    setHasConverted(false);
    setError(null);
  };

  const handleBatchConvert = async () => {
    if (items.length === 0) return;

    // Check if target format is AVIF and supported
    if (outputFormat === 'avif' && !isMimeSupported('image/avif')) {
      setError('Your current browser does not support encoding images to AVIF. Please select WebP, PNG, or JPG.');
      return;
    }

    setIsConverting(true);
    setError(null);

    const updated = [...items];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      item.status = 'converting';
      setItems([...updated]);

      try {
        const blob = await convertSingleImage(item.file, {
          outputFormat,
          quality,
        });
        const url = URL.createObjectURL(blob);
        item.status = 'done';
        item.convertedBlob = blob;
        item.convertedUrl = url;
        item.convertedSize = blob.size;
        item.outputFormat = outputFormat;
      } catch (err: unknown) {
        item.status = 'error';
        item.error = err instanceof Error ? err.message : 'Conversion failed';
      }

      setItems([...updated]);
    }

    setIsConverting(false);
    setHasConverted(true);
  };

  const handleDownloadSingle = (item: ConversionItem) => {
    if (!item.convertedBlob) return;
    const ext = item.outputFormat || outputFormat;
    const filename = sanitizeFileName(item.file.name, '_converted', ext);
    downloadBlob(item.convertedBlob, filename);
  };

  const handleDownloadAllZip = async () => {
    const readyItems = items.filter((i) => i.convertedBlob);
    if (readyItems.length === 0) return;

    const zipList = readyItems.map((item) => ({
      filename: sanitizeFileName(item.file.name, '_converted', item.outputFormat || outputFormat),
      blob: item.convertedBlob!,
    }));

    const zipBlob = await createConvertedZip(zipList);
    downloadBlob(zipBlob, `readyfile_converted_${outputFormat}.zip`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Image Format Converter
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Convert one or multiple images between standard web and print formats. Supports JPG, PNG, WebP, BMP, and GIF, processed 100% locally in your browser.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {items.length === 0 && !isConverting && (
        <UploadArea
          multiple
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.svg"
          title="Drop image files here to convert"
          subtitle="Supports JPG, PNG, WebP, GIF, BMP, AVIF, and SVG"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Selected Items & Conversion Settings */}
      {items.length > 0 && (
        <div className="space-y-6">
          {/* Settings & Batch Controls Toolbar */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E7EAF0] mb-5">
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                  Conversion Target Settings
                </h3>
                <span className="text-xs text-[#687386]">
                  {items.length} {items.length === 1 ? 'image' : 'images'} loaded
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-medium text-[#182230] transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add more images</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleFiles(Array.from(e.target.files));
                      e.target.value = '';
                    }}
                  />
                </label>

                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#E05252] hover:bg-red-50 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Convert all to format:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['webp', 'jpg', 'png', 'bmp'] as OutputFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setOutputFormat(fmt)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border text-center uppercase transition-colors ${
                        outputFormat === fmt
                          ? 'bg-[#5278F5] text-white border-[#5278F5] shadow-xs'
                          : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0] hover:bg-[#E7EAF0]'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {(outputFormat === 'jpg' || outputFormat === 'webp') && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-[#182230]">Quality Level</span>
                    <span className="font-mono text-[#5278F5] font-semibold">{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    step="5"
                    value={Math.round(quality * 100)}
                    onChange={(e) => setQuality(Number(e.target.value) / 100)}
                    className="w-full accent-[#5278F5] cursor-pointer mt-1"
                  />
                  <div className="flex justify-between text-[11px] text-[#687386]">
                    <span>Smaller file</span>
                    <span>Higher quality</span>
                  </div>
                </div>
              )}
            </div>

            {outputFormat === 'jpg' && (
              <p className="mt-3 text-[11px] text-[#687386] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#5278F5] shrink-0" />
                <span>Transparent PNG/WebP images converted to JPEG will receive a clean white background.</span>
              </p>
            )}

            <div className="mt-5 pt-4 border-t border-[#E7EAF0] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[#687386]">
                Target: <strong>{outputFormat.toUpperCase()}</strong> • High-fidelity Canvas conversion
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {hasConverted && (
                  <button
                    onClick={handleDownloadAllZip}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-lg border border-[#E7EAF0] bg-[#FFFFFF] hover:bg-[#F4F6FA] text-xs font-semibold text-[#182230] flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Archive className="w-3.5 h-3.5 text-[#5278F5]" />
                    <span>Download All (ZIP)</span>
                  </button>
                )}

                <button
                  onClick={handleBatchConvert}
                  disabled={isConverting}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConverting ? 'animate-spin' : ''}`} />
                  <span>{isConverting ? 'Converting...' : `Convert All (${items.length})`}</span>
                </button>
              </div>
            </div>
          </div>

          {/* List of Files */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl overflow-hidden divide-y divide-[#E7EAF0] shadow-sm">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F4F6FA]/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#182230] truncate" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-[#687386] mt-0.5">
                      <span className="font-semibold text-[#182230]">{item.sourceFormat}</span>
                      <span>•</span>
                      <span>{formatBytes(item.file.size)}</span>
                      {item.convertedSize && (
                        <>
                          <span>→</span>
                          <span className="font-semibold text-[#5278F5]">
                            {item.outputFormat?.toUpperCase()}: {formatBytes(item.convertedSize)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Status & Download Action */}
                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  {item.status === 'converting' && (
                    <span className="text-xs text-[#5278F5] animate-pulse">Converting...</span>
                  )}

                  {item.status === 'done' && (
                    <button
                      onClick={() => handleDownloadSingle(item)}
                      className="px-3 py-1.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {item.outputFormat?.toUpperCase()}</span>
                    </button>
                  )}

                  {item.status === 'error' && (
                    <span className="text-xs text-[#E05252] flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{item.error || 'Failed'}</span>
                    </span>
                  )}

                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 rounded text-[#687386] hover:text-[#E05252] hover:bg-red-50 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
