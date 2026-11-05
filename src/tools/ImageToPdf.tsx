import React, { useState } from 'react';
import { 
  Download, 
  RotateCcw, 
  ArrowRight, 
  Check, 
  FileImage, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Sliders, 
  FileText,
  Plus
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { convertImagesToPdf, ImageToPdfItem, ImageToPdfOptions } from '../services/pdfService';
import { getImageDimensions, formatBytes, downloadBlob } from '../utils/fileHelpers';

interface ImageToPdfProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const ImageToPdf: React.FC<ImageToPdfProps> = ({ onNavigateToTool }) => {
  const [items, setItems] = useState<ImageToPdfItem[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState<Blob | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    setError(null);
    setGeneratedPdfBlob(null);

    const newItems: ImageToPdfItem[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dims = await getImageDimensions(file);
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          file,
          previewUrl,
          width: dims.width,
          height: dims.height,
        });
      } catch {
        // Skip unreadable files or notify
      }
    }

    if (newItems.length === 0) {
      setError('None of the selected files were valid images (JPEG, PNG, WebP).');
      return;
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleConvert = async () => {
    if (items.length === 0) {
      setError('Please select at least one image.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const blob = await convertImagesToPdf(items, {
        pageSize,
        orientation,
      });
      const url = URL.createObjectURL(blob);
      setGeneratedPdfBlob(blob);
      setPdfPreviewUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!generatedPdfBlob) return;
    const baseName = items.length === 1 ? items[0].file.name.replace(/\.[^/.]+$/, '') : 'readyfile-document';
    downloadBlob(generatedPdfBlob, `${baseName}.pdf`);
  };

  const handleReset = () => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setItems([]);
    setGeneratedPdfBlob(null);
    setPdfPreviewUrl(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Image to PDF
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Convert one or multiple image scans and photos into a single professional PDF document. Reorder pages, configure standard A4 or Letter sizes, and download immediately.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload Zone */}
      {items.length === 0 && !isProcessing && (
        <UploadArea
          multiple
          accept="image/jpeg,image/png,image/webp,image/jpg"
          allowedExtensions={['jpg', 'jpeg', 'png', 'webp']}
          title="Drop image files here to convert into PDF"
          subtitle="Select single or multiple photos / page scans (JPEG, PNG, WebP)"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Reordering & Settings view */}
      {items.length > 0 && !generatedPdfBlob && !isProcessing && (
        <div className="space-y-6">
          {/* Top toolbar */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                {items.length} {items.length === 1 ? 'Page' : 'Pages'} Selected
              </span>
              <span className="text-xs text-[#687386]">
                ({formatBytes(items.reduce((acc, curr) => acc + curr.file.size, 0))})
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-medium text-[#182230] transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span>Add more images</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/jpg"
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

          {/* Grid of uploaded items with reordering buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-3 flex flex-col justify-between shadow-sm relative group"
              >
                {/* Page number badge */}
                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[11px] font-bold bg-[#182230]/80 text-white backdrop-blur-sm">
                  Page {index + 1}
                </span>

                {/* Thumbnail */}
                <div className="w-full h-40 bg-[#F4F6FA] rounded-lg overflow-hidden flex items-center justify-center mb-2.5">
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                {/* Details */}
                <div className="mb-2">
                  <p className="text-xs font-medium text-[#182230] truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p className="text-[11px] text-[#687386]">
                    {item.width} × {item.height} px • {formatBytes(item.file.size)}
                  </p>
                </div>

                {/* Action buttons (Move Up, Move Down, Delete) */}
                <div className="flex items-center justify-between pt-2 border-t border-[#E7EAF0]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="p-1 rounded text-[#687386] hover:text-[#5278F5] disabled:opacity-30 disabled:hover:text-[#687386]"
                      title="Move earlier"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="p-1 rounded text-[#687386] hover:text-[#5278F5] disabled:opacity-30 disabled:hover:text-[#687386]"
                      title="Move later"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="p-1 rounded text-[#687386] hover:text-[#E05252]"
                    title="Remove page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* PDF Layout Configuration */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6">
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230] mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#5278F5]" />
              <span>PDF Document Settings</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Page Standard
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPageSize('A4')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                      pageSize === 'A4'
                        ? 'bg-[#5278F5] text-white border-[#5278F5]'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                    }`}
                  >
                    A4 (210 × 297 mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageSize('Letter')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                      pageSize === 'Letter'
                        ? 'bg-[#5278F5] text-white border-[#5278F5]'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                    }`}
                  >
                    US Letter (8.5 × 11 in)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Page Orientation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                      orientation === 'portrait'
                        ? 'bg-[#5278F5] text-white border-[#5278F5]'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                    }`}
                  >
                    Portrait (Vertical)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors ${
                      orientation === 'landscape'
                        ? 'bg-[#5278F5] text-white border-[#5278F5]'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                    }`}
                  >
                    Landscape (Horizontal)
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleConvert}
              className="w-full h-11 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span>Generate PDF ({items.length} {items.length === 1 ? 'Page' : 'Pages'})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && <ProcessingState message="Compiling images into PDF document..." />}

      {/* Result Card */}
      {generatedPdfBlob && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                PDF Created Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Convert new batch</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Total Pages</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {items.length} {items.length === 1 ? 'Page' : 'Pages'}
              </p>
            </div>

            <div className="bg-[#5278F5]/5 border border-[#5278F5]/20 rounded-lg p-4">
              <span className="text-xs text-[#5278F5] font-medium">PDF File Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {formatBytes(generatedPdfBlob.size)}
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Page Settings</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {pageSize} • {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              Generated locally using pdf-lib • No server transmission
            </span>
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF Document</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
