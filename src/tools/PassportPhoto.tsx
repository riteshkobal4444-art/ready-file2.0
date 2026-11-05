import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  UserCheck, 
  RotateCcw, 
  Download, 
  Check, 
  Sliders, 
  Info, 
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Maximize2
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { 
  PASSPORT_PRESETS, 
  PassportPreset, 
  PassportUnit, 
  PassportResult, 
  generatePassportPhoto, 
  convertToPixels 
} from '../services/passportService';
import { loadImage } from '../services/cropService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';

interface PassportPhotoProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const PassportPhoto: React.FC<PassportPhotoProps> = ({ onNavigateToTool }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number } | null>(null);

  // Selected preset or custom
  const [selectedPresetId, setSelectedPresetId] = useState<string>('schengen-35x45');
  const [unit, setUnit] = useState<PassportUnit>('mm');
  const [widthVal, setWidthVal] = useState<number>(35);
  const [heightVal, setHeightVal] = useState<number>(45);

  const [dpi, setDpi] = useState<300 | 600>(300);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [backgroundColor, setBackgroundColor] = useState<'white' | 'light-blue' | 'light-grey' | 'original'>('white');
  const [maxSizeKB, setMaxSizeKB] = useState<string>('240'); // common 240KB limit

  // Crop box in percentage of container (0 to 100)
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 20,
    y: 10,
    width: 60,
    height: 75,
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<PassportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<{ mode: 'move' | 'se'; startX: number; startY: number; initBox: typeof cropBox } | null>(null);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    setError(null);
    setResult(null);

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, or WebP).');
      return;
    }

    try {
      const img = await loadImage(file);
      setNaturalDims({ width: img.naturalWidth, height: img.naturalHeight });
      setSelectedFile(file);
      setPreviewSrc(URL.createObjectURL(file));
      setCropBox({ x: 20, y: 10, width: 60, height: 75 });
    } catch {
      setError('Could not decode the photo file.');
    }
  };

  const applyPreset = (preset: PassportPreset) => {
    setSelectedPresetId(preset.id);
    setWidthVal(preset.width);
    setHeightVal(preset.height);
    setUnit(preset.unit);

    // Adjust crop box proportion
    const targetRatio = preset.width / preset.height;
    setCropBox((prev) => {
      let newW = prev.width;
      let newH = newW / targetRatio;
      if (newH > 85) {
        newH = 80;
        newW = newH * targetRatio;
      }
      return { ...prev, width: newW, height: newH };
    });
  };

  const handlePointerDown = (e: React.PointerEvent, mode: 'move' | 'se') => {
    e.preventDefault();
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

      const currentRatio = widthVal / heightVal;

      if (mode === 'move') {
        const nextX = Math.max(0, Math.min(100 - initBox.width, initBox.x + deltaXPercent));
        const nextY = Math.max(0, Math.min(100 - initBox.height, initBox.y + deltaYPercent));
        setCropBox((prev) => ({ ...prev, x: nextX, y: nextY }));
      } else if (mode === 'se') {
        let nextW = Math.max(15, Math.min(100 - initBox.x, initBox.width + deltaXPercent));
        let nextH = nextW / currentRatio;
        if (initBox.y + nextH > 100) {
          nextH = 100 - initBox.y;
          nextW = nextH * currentRatio;
        }
        setCropBox((prev) => ({ ...prev, width: nextW, height: nextH }));
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
  }, [widthVal, heightVal]);

  const handleGenerate = async () => {
    if (!selectedFile || !naturalDims) return;
    setIsProcessing(true);
    setError(null);

    try {
      const realX = (cropBox.x / 100) * naturalDims.width;
      const realY = (cropBox.y / 100) * naturalDims.height;
      const realW = (cropBox.width / 100) * naturalDims.width;
      const realH = (cropBox.height / 100) * naturalDims.height;

      const parsedMaxSize = parseFloat(maxSizeKB);

      const res = await generatePassportPhoto(selectedFile, {
        width: widthVal,
        height: heightVal,
        unit,
        dpi,
        format,
        backgroundColor,
        maxSizeKB: parsedMaxSize > 0 ? parsedMaxSize : undefined,
        cropRect: {
          x: realX,
          y: realY,
          width: realW,
          height: realH,
        },
      });

      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Photo generation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !selectedFile) return;
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    const filename = sanitizeFileName(selectedFile.name, `_passport_${result.pixelWidth}x${result.pixelHeight}`, ext);
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
  };

  const currentPixelTargetW = convertToPixels(widthVal, unit, dpi);
  const currentPixelTargetH = convertToPixels(heightVal, unit, dpi);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Passport Photo Maker
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Format compliant digital passport, visa, and ID photos with exact pixel calculations, DPI standards, head framing guides, and file size ceilings.
        </p>

        {/* Disclaimer Notice */}
        <div className="mt-4 p-3 rounded-lg bg-[#F4F6FA] border border-[#E7EAF0] text-xs text-[#687386] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[#5278F5] shrink-0 mt-0.5" />
          <span>
            <strong>Verification Notice:</strong> This tool precisely formats digital dimensions and file weights. Official criteria (such as neutral facial expressions, absence of glasses, and lighting) must be verified against your government authority’s specific rules.
          </span>
        </div>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && (
        <UploadArea
          accept="image/jpeg,image/png,image/webp,image/jpg"
          allowedExtensions={['jpg', 'jpeg', 'png', 'webp']}
          title="Drop portrait photo here"
          subtitle="Choose a clear front-facing photo on a light wall"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Interactive Tool Interface */}
      {selectedFile && previewSrc && !result && !isProcessing && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Visual Positioning Area */}
          <div className="md:col-span-7 bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[#687386] mb-3">
                <span className="font-medium text-[#182230] truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
                <span className="font-mono text-[#5278F5] font-semibold">
                  Target: {currentPixelTargetW} × {currentPixelTargetH} px ({dpi} DPI)
                </span>
              </div>

              {/* Framing Canvas */}
              <div
                ref={containerRef}
                className="relative w-full h-80 sm:h-96 bg-[#182230]/5 rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center select-none touch-none"
              >
                <img
                  src={previewSrc}
                  alt="Portrait source"
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-[#182230]/40 pointer-events-none" />

                {/* Crop & Head Guide Frame */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'move')}
                  style={{
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.width}%`,
                    height: `${cropBox.height}%`,
                  }}
                  className="absolute border-2 border-[#5278F5] shadow-[0_0_0_9999px_rgba(24,34,48,0.45)] cursor-move transition-[box-shadow]"
                >
                  {/* Facial Alignment Overlay: Oval head boundary & eye level */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {/* Head oval */}
                    <div className="w-[60%] h-[70%] border-2 border-dashed border-[#5278F5]/80 rounded-[50%] mt-2 relative">
                      {/* Eye level line */}
                      <div className="absolute top-[42%] left-0 right-0 border-t border-dotted border-[#24B47E]" />
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-white bg-[#182230]/80 px-1 rounded">
                        Top of Head
                      </span>
                      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-white bg-[#182230]/80 px-1 rounded">
                        Chin Line
                      </span>
                    </div>
                  </div>

                  {/* Corner Resize Handle */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'se')}
                    className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-[#5278F5] rounded-full cursor-nwse-resize z-20"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-[#687386]">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-[#5278F5]" />
                  <span>Align face inside the oval guide (50-69% frame height).</span>
                </span>
                <button
                  onClick={handleReset}
                  className="text-xs text-[#687386] hover:text-[#E05252] transition-colors"
                >
                  Change photo
                </button>
              </div>
            </div>
          </div>

          {/* Dimension & Specification Controls */}
          <div className="md:col-span-5 bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E7EAF0]">
                <Sliders className="w-4 h-4 text-[#5278F5]" />
                <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                  Passport Specifications
                </h3>
              </div>

              {/* Presets */}
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Standard Country Presets
                </label>
                <div className="space-y-1.5">
                  {PASSPORT_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`w-full text-left p-2 rounded-lg text-xs border transition-colors ${
                          isSelected
                            ? 'bg-[#5278F5]/5 border-[#5278F5] shadow-xs'
                            : 'bg-[#F4F6FA] border-[#E7EAF0] hover:bg-[#E7EAF0]'
                        }`}
                      >
                        <div className="font-semibold text-[#182230]">{preset.name}</div>
                        <div className="text-[11px] text-[#687386]">{preset.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Dimensions */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[#182230] mb-1">
                  <span>Custom Size & Units</span>
                  <div className="flex gap-1">
                    {(['mm', 'cm', 'in', 'px'] as PassportUnit[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId('custom');
                          setUnit(u);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          unit === u ? 'bg-[#5278F5] text-white' : 'bg-[#F4F6FA] text-[#687386]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#687386] mb-0.5">Width ({unit})</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={widthVal}
                      onChange={(e) => {
                        setSelectedPresetId('custom');
                        setWidthVal(parseFloat(e.target.value) || 1);
                      }}
                      className="w-full h-8 px-2 bg-[#FFFFFF] border border-[#E7EAF0] rounded text-xs font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#687386] mb-0.5">Height ({unit})</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={heightVal}
                      onChange={(e) => {
                        setSelectedPresetId('custom');
                        setHeightVal(parseFloat(e.target.value) || 1);
                      }}
                      className="w-full h-8 px-2 bg-[#FFFFFF] border border-[#E7EAF0] rounded text-xs font-mono text-[#182230] focus:outline-none focus:border-[#5278F5]"
                    />
                  </div>
                </div>
              </div>

              {/* Print DPI & Format */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">Print Resolution</label>
                  <select
                    value={dpi}
                    onChange={(e) => setDpi(Number(e.target.value) as any)}
                    className="w-full h-8 px-2 bg-[#FFFFFF] border border-[#E7EAF0] rounded text-xs text-[#182230]"
                  >
                    <option value={300}>300 DPI (Standard)</option>
                    <option value={600}>600 DPI (Ultra Sharp)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">Max File Size</label>
                  <input
                    type="number"
                    placeholder="KB"
                    value={maxSizeKB}
                    onChange={(e) => setMaxSizeKB(e.target.value)}
                    className="w-full h-8 px-2 bg-[#FFFFFF] border border-[#E7EAF0] rounded text-xs font-mono text-[#182230]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-5">
              <button
                onClick={handleGenerate}
                className="w-full h-11 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Generate Passport Photo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing */}
      {isProcessing && <ProcessingState message="Cropping and calibrating passport photo specifications..." />}

      {/* Result View */}
      {result && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Passport Photo Prepared Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Prepare another photo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Physical Dimensions</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {result.printWidthMm} × {result.printHeightMm} mm
              </p>
              <span className="text-[11px] text-[#687386]">@ {dpi} DPI</span>
            </div>

            <div className="bg-[#5278F5]/5 border border-[#5278F5]/20 rounded-lg p-4">
              <span className="text-xs text-[#5278F5] font-medium">Digital Dimensions</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {result.pixelWidth} × {result.pixelHeight} px
              </p>
              <span className="text-[11px] text-[#5278F5] font-mono">{formatBytes(result.fileSize)}</span>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Target Compliance</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#24B47E] mt-0.5">
                Pass (Technical)
              </p>
              <span className="text-[11px] text-[#687386]">Under {maxSizeKB} KB limit</span>
            </div>
          </div>

          {/* Photo Preview */}
          <div className="pt-2 flex flex-col items-center">
            <span className="text-xs font-semibold text-[#182230] block mb-2">Final Photo Output</span>
            <div className="p-3 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg inline-block shadow-sm">
              <img
                src={result.previewUrl}
                alt="Passport final"
                className="max-h-72 object-contain rounded shadow-xs"
              />
            </div>
          </div>

          {/* Download & verify */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              {result.pixelWidth} × {result.pixelHeight} px • {formatBytes(result.fileSize)}
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onNavigateToTool && (
                <button
                  onClick={() => onNavigateToTool('file-checker')}
                  className="px-4 py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-semibold text-[#182230] transition-colors"
                >
                  Verify with checker
                </button>
              )}

              <button
                onClick={handleDownload}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
