import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Crop, 
  RotateCcw, 
  RotateCw, 
  RotateCcw as ResetIcon,
  Download, 
  Check, 
  ArrowRight, 
  Sliders, 
  Info,
  Maximize2
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { executeCrop, CropResult, CropRect, loadImage } from '../services/cropService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';

interface ImageCropperProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

type AspectRatioOption = 'free' | 'original' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3' | 'custom';

export const ImageCropper: React.FC<ImageCropperProps> = ({ onNavigateToTool }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number } | null>(null);

  // Crop Box state in percentages (0 to 100) relative to displayed image container
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });

  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('free');
  const [customRatioW, setCustomRatioW] = useState<string>('1');
  const [customRatioH, setCustomRatioH] = useState<string>('1');
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270

  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [quality, setQuality] = useState<number>(0.92);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<CropResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<{ mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; initBox: typeof cropBox } | null>(null);

  // Effective dimensions accounting for 90 or 270 degree rotation
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const effectiveWidth = naturalDims ? (isRotated90or270 ? naturalDims.height : naturalDims.width) : 800;
  const effectiveHeight = naturalDims ? (isRotated90or270 ? naturalDims.width : naturalDims.height) : 600;

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    setError(null);
    setResult(null);

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image (JPG, PNG, or WEBP).');
      return;
    }

    try {
      const img = await loadImage(file);
      setNaturalDims({ width: img.naturalWidth, height: img.naturalHeight });
      setSelectedFile(file);
      setPreviewSrc(URL.createObjectURL(file));
      setRotation(0);
      setCropBox({ x: 10, y: 10, width: 80, height: 80 });
      // Default to PNG if source is PNG to preserve alpha
      if (file.type === 'image/png') {
        setOutputFormat('image/png');
      } else if (file.type === 'image/webp') {
        setOutputFormat('image/webp');
      } else {
        setOutputFormat('image/jpeg');
      }
    } catch {
      setError('Could not decode the selected image file.');
    }
  };

  // Adjust crop box when aspect ratio changes
  const applyAspectRatio = useCallback((ratio: AspectRatioOption, rw = 1, rh = 1) => {
    setAspectRatio(ratio);
    if (ratio === 'free') return;

    let targetRatio = 1;
    if (ratio === 'original' && naturalDims) {
      targetRatio = effectiveWidth / effectiveHeight;
    } else if (ratio === '1:1') targetRatio = 1;
    else if (ratio === '4:3') targetRatio = 4 / 3;
    else if (ratio === '3:4') targetRatio = 3 / 4;
    else if (ratio === '16:9') targetRatio = 16 / 9;
    else if (ratio === '9:16') targetRatio = 9 / 16;
    else if (ratio === '3:2') targetRatio = 3 / 2;
    else if (ratio === '2:3') targetRatio = 2 / 3;
    else if (ratio === 'custom') {
      targetRatio = (parseFloat(customRatioW) || 1) / (parseFloat(customRatioH) || 1);
    }

    // Adjust crop box width & height to match aspect ratio within [0, 100]
    setCropBox((prev) => {
      let newW = prev.width;
      let newH = newW / targetRatio;
      if (newH > 90) {
        newH = 80;
        newW = newH * targetRatio;
      }
      if (newW > 90) {
        newW = 80;
        newH = newW / targetRatio;
      }
      const newX = Math.max(0, Math.min(100 - newW, 50 - newW / 2));
      const newY = Math.max(0, Math.min(100 - newH, 50 - newH / 2));
      return { x: newX, y: newY, width: newW, height: newH };
    });
  }, [naturalDims, effectiveWidth, effectiveHeight, customRatioW, customRatioH]);

  const handleRotate = (dir: 'left' | 'right') => {
    setRotation((prev) => {
      const next = dir === 'right' ? (prev + 90) % 360 : (prev + 270) % 360;
      return next;
    });
    // Reset crop box to safe centered region
    setCropBox({ x: 15, y: 15, width: 70, height: 70 });
  };

  // Mouse & Touch Dragging of the Crop Box
  const handlePointerDown = (e: React.PointerEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initBox: { ...cropBox },
    };
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const { mode, startX, startY, initBox } = isDraggingRef.current;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaXPercent = ((e.clientX - startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - startY) / rect.height) * 100;

      if (mode === 'move') {
        const nextX = Math.max(0, Math.min(100 - initBox.width, initBox.x + deltaXPercent));
        const nextY = Math.max(0, Math.min(100 - initBox.height, initBox.y + deltaYPercent));
        setCropBox((prev) => ({ ...prev, x: nextX, y: nextY }));
      } else if (mode === 'se') {
        const nextW = Math.max(10, Math.min(100 - initBox.x, initBox.width + deltaXPercent));
        const nextH = Math.max(10, Math.min(100 - initBox.y, initBox.height + deltaYPercent));
        setCropBox((prev) => ({ ...prev, width: nextW, height: nextH }));
      } else if (mode === 'nw') {
        const nextX = Math.max(0, Math.min(initBox.x + initBox.width - 10, initBox.x + deltaXPercent));
        const nextY = Math.max(0, Math.min(initBox.y + initBox.height - 10, initBox.y + deltaYPercent));
        const nextW = initBox.width + (initBox.x - nextX);
        const nextH = initBox.height + (initBox.y - nextY);
        setCropBox({ x: nextX, y: nextY, width: nextW, height: nextH });
      } else if (mode === 'ne') {
        const nextY = Math.max(0, Math.min(initBox.y + initBox.height - 10, initBox.y + deltaYPercent));
        const nextW = Math.max(10, Math.min(100 - initBox.x, initBox.width + deltaXPercent));
        const nextH = initBox.height + (initBox.y - nextY);
        setCropBox((prev) => ({ ...prev, y: nextY, width: nextW, height: nextH }));
      } else if (mode === 'sw') {
        const nextX = Math.max(0, Math.min(initBox.x + initBox.width - 10, initBox.x + deltaXPercent));
        const nextW = initBox.width + (initBox.x - nextX);
        const nextH = Math.max(10, Math.min(100 - initBox.y, initBox.height + deltaYPercent));
        setCropBox((prev) => ({ ...prev, x: nextX, width: nextW, height: nextH }));
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Compute calculated output dimensions in natural image pixels
  const realCropX = Math.round((cropBox.x / 100) * effectiveWidth);
  const realCropY = Math.round((cropBox.y / 100) * effectiveHeight);
  const realCropW = Math.max(1, Math.round((cropBox.width / 100) * effectiveWidth));
  const realCropH = Math.max(1, Math.round((cropBox.height / 100) * effectiveHeight));

  const handlePerformCrop = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setError(null);

    try {
      const cropRect: CropRect = {
        x: realCropX,
        y: realCropY,
        width: realCropW,
        height: realCropH,
      };

      const res = await executeCrop(selectedFile, {
        rect: cropRect,
        rotation,
        outputFormat,
        quality,
      });

      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cropping failed. Please try a different selection.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const ext = result.mimeType.split('/')[1] || 'jpg';
    const filename = sanitizeFileName(selectedFile.name, `_cropped_${result.width}x${result.height}`, ext);
    downloadBlob(result.blob, filename);
  };

  const handleReset = () => {
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    setSelectedFile(null);
    setPreviewSrc(null);
    setNaturalDims(null);
    setResult(null);
    setError(null);
    setRotation(0);
    setCropBox({ x: 10, y: 10, width: 80, height: 80 });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Image Cropper
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Trim and frame your images with pixel precision. Drag the crop handles, choose standard aspect ratios, rotate orientations, and download in JPG, PNG, or WebP.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* State 1: Upload */}
      {!selectedFile && (
        <UploadArea
          accept="image/jpeg,image/png,image/webp,image/jpg"
          allowedExtensions={['jpg', 'jpeg', 'png', 'webp']}
          title="Drop an image here to crop"
          subtitle="Supports JPEG, PNG, and WebP up to 50 MB"
          onFilesSelected={handleFiles}
        />
      )}

      {/* State 2: Interactive Cropper View */}
      {selectedFile && previewSrc && !result && !isProcessing && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Main Visual Crop Canvas */}
          <div className="md:col-span-8 bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[#687386] mb-3">
                <span className="font-medium text-[#182230] truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
                <span className="font-mono">
                  {effectiveWidth} × {effectiveHeight} px ({formatBytes(selectedFile.size)})
                </span>
              </div>

              {/* Crop Canvas Area */}
              <div
                ref={containerRef}
                className="relative w-full h-80 sm:h-96 bg-[#182230]/5 rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center select-none touch-none"
              >
                {/* Rotated image element */}
                <img
                  src={previewSrc}
                  alt="Crop preview"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    maxWidth: isRotated90or270 ? '70%' : '90%',
                    maxHeight: isRotated90or270 ? '70%' : '90%',
                  }}
                  className="pointer-events-none object-contain transition-transform duration-200"
                />

                {/* Dark overlay backdrop around crop */}
                <div className="absolute inset-0 bg-[#182230]/40 pointer-events-none" />

                {/* Draggable Active Crop Rectangle */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'move')}
                  style={{
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.width}%`,
                    height: `${cropBox.height}%`,
                  }}
                  className="absolute border-2 border-[#5278F5] bg-transparent shadow-[0_0_0_9999px_rgba(24,34,48,0.45)] cursor-move transition-[box-shadow]"
                >
                  {/* Rule of thirds grid lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                    <div className="border-r border-b border-white" />
                    <div className="border-r border-b border-white" />
                    <div className="border-b border-white" />
                    <div className="border-r border-b border-white" />
                    <div className="border-r border-b border-white" />
                    <div className="border-b border-white" />
                    <div className="border-r border-white" />
                    <div className="border-r border-white" />
                    <div />
                  </div>

                  {/* Corner Resize Handles */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'nw')}
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#5278F5] rounded-full cursor-nwse-resize z-20"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'ne')}
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#5278F5] rounded-full cursor-nesw-resize z-20"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'sw')}
                    className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#5278F5] rounded-full cursor-nesw-resize z-20"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'se')}
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#5278F5] rounded-full cursor-nwse-resize z-20"
                  />

                  {/* Real Dimension Pill */}
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#182230] text-white pointer-events-none whitespace-nowrap shadow-sm">
                    {realCropW} × {realCropH} px
                  </div>
                </div>
              </div>

              {/* Bottom rotate & reset toolbar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRotate('left')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] font-medium transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#5278F5]" />
                    <span>Rotate Left (-90°)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotate('right')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-[#182230] font-medium transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#5278F5]" />
                    <span>Rotate Right (+90°)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCropBox({ x: 10, y: 10, width: 80, height: 80 });
                      setRotation(0);
                      setAspectRatio('free');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[#687386] hover:text-[#182230] transition-colors"
                  >
                    <ResetIcon className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                <button
                  onClick={handleReset}
                  className="text-xs text-[#687386] hover:text-[#E05252] transition-colors"
                >
                  Choose different image
                </button>
              </div>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="md:col-span-4 bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E7EAF0]">
                <Sliders className="w-4 h-4 text-[#5278F5]" />
                <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                  Crop Ratios & Format
                </h3>
              </div>

              {/* Aspect Ratio Buttons */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-2">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['free', 'original', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'] as AspectRatioOption[]).map(
                    (ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => applyAspectRatio(ratio)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors capitalize ${
                          aspectRatio === ratio
                            ? 'bg-[#5278F5] text-white border-[#5278F5] shadow-xs'
                            : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0] hover:bg-[#E7EAF0]'
                        }`}
                      >
                        {ratio === 'original' ? 'Original' : ratio}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Custom Aspect Ratio */}
              <div>
                <button
                  type="button"
                  onClick={() => applyAspectRatio('custom')}
                  className={`text-xs font-semibold mb-1.5 block ${
                    aspectRatio === 'custom' ? 'text-[#5278F5]' : 'text-[#182230]'
                  }`}
                >
                  Custom Ratio (W : H)
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="W"
                    value={customRatioW}
                    onChange={(e) => {
                      setCustomRatioW(e.target.value);
                      applyAspectRatio('custom');
                    }}
                    className="w-full h-8 px-2 bg-[#FFFFFF] border border-[#E7EAF0] rounded-md text-xs font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                  />
                  <span className="text-[#687386] font-bold">:</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="H"
                    value={customRatioH}
                    onChange={(e) => {
                      setCustomRatioH(e.target.value);
                      applyAspectRatio('custom');
                    }}
                    className="w-full h-8 px-2 bg-[#FFFFFF] border border-[#E7EAF0] rounded-md text-xs font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                  />
                </div>
              </div>

              {/* Output format */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Output Format
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                >
                  <option value="image/jpeg">JPEG (.jpg)</option>
                  <option value="image/png">PNG (.png - preserves transparency)</option>
                  <option value="image/webp">WebP (.webp)</option>
                </select>
              </div>

              {/* Quality Slider for JPEG & WebP */}
              {outputFormat !== 'image/png' && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-[#182230]">Quality</span>
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
            </div>

            <div className="pt-6">
              <button
                onClick={handlePerformCrop}
                className="w-full h-11 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Apply Crop</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && <ProcessingState message="Cropping image in your browser..." />}

      {/* State 3: Crop Result */}
      {result && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Image Cropped Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Crop another image</span>
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Cropped Dimensions</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {result.width} × {result.height} px
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Output File Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {formatBytes(result.fileSize)}
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Format</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5 uppercase">
                {result.mimeType.split('/')[1]}
              </p>
            </div>
          </div>

          {/* Result preview */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-[#182230] block mb-2">Cropped Output Preview</span>
            <div className="w-full h-72 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] flex items-center justify-center p-3">
              <img src={result.previewUrl} alt="Cropped output" className="max-h-full max-w-full object-contain rounded" />
            </div>
          </div>

          {/* Download Action */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              Dimensions: {result.width} × {result.height} px • {formatBytes(result.fileSize)}
            </span>
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Cropped Image</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
