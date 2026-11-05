import React, { useState, useRef, useEffect } from 'react';
import { 
  PenTool, 
  Type, 
  Upload, 
  RotateCcw, 
  Download, 
  Trash2, 
  Undo, 
  Sliders, 
  Check, 
  ShieldAlert, 
  FileCheck,
  Sparkles
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { 
  SignatureStroke, 
  SignaturePoint, 
  SIGNATURE_FONTS, 
  SIGNATURE_COLORS, 
  renderStrokesToCanvas, 
  renderTypedSignature, 
  extractPaperSignature, 
  trimCanvas 
} from '../services/signatureService';
import { loadImage } from '../services/cropService';
import { downloadBlob, formatBytes } from '../utils/fileHelpers';

type SignatureMode = 'draw' | 'type' | 'upload';

export const SignatureMaker: React.FC = () => {
  const [mode, setMode] = useState<SignatureMode>('draw');

  // Drawing mode state
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<SignaturePoint[]>([]);
  const [penColor, setPenColor] = useState<string>('#182230');
  const [penWidth, setPenWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Type mode state
  const [typedText, setTypedText] = useState<string>('Jane Doe');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].font);
  const [typedFontSize, setTypedFontSize] = useState<number>(56);
  const [typedColor, setTypedColor] = useState<string>('#182230');

  // Upload mode state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadImgEl, setUploadImgEl] = useState<HTMLImageElement | null>(null);
  const [paperThreshold, setPaperThreshold] = useState<number>(195);
  const [uploadInkColor, setUploadInkColor] = useState<string>('#182230');

  // Output export options
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');

  // Drawing canvas ref
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  // Redraw drawn canvas when strokes change
  useEffect(() => {
    if (mode === 'draw' && drawCanvasRef.current) {
      const canvas = drawCanvasRef.current;
      renderStrokesToCanvas(canvas, strokes);
    }
  }, [strokes, mode]);

  // Handle pointer draw events on canvas
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): SignaturePoint => {
    const canvas = drawCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getCoordinates(e);
    setIsDrawing(true);
    setCurrentStroke([point]);

    // Draw single point immediately
    const canvas = drawCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = penColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, penWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getCoordinates(e);
    const updated = [...currentStroke, point];
    setCurrentStroke(updated);

    const canvas = drawCanvasRef.current;
    if (canvas && updated.length > 1) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const p1 = updated[updated.length - 2];
        const p2 = updated[updated.length - 1];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes((prev) => [
        ...prev,
        {
          points: currentStroke,
          color: penColor,
          width: penWidth,
        },
      ]);
      setCurrentStroke([]);
    }
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClearDraw = () => {
    setStrokes([]);
    if (drawCanvasRef.current) {
      const ctx = drawCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
    }
  };

  // Upload handler for Method C
  const handleSignatureUpload = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    try {
      const img = await loadImage(file);
      setUploadImgEl(img);
      setUploadedFile(file);
    } catch {
      // Decode error
    }
  };

  // Export & Download
  const handleDownloadSignature = async () => {
    let finalCanvas: HTMLCanvasElement | null = null;
    const bg = exportFormat === 'jpg' ? 'white' : 'transparent';

    if (mode === 'draw') {
      if (strokes.length === 0) return;
      const temp = document.createElement('canvas');
      temp.width = 1200;
      temp.height = 500;
      renderStrokesToCanvas(temp, strokes, bg);
      finalCanvas = trimCanvas(temp);
    } else if (mode === 'type') {
      finalCanvas = await renderTypedSignature(
        typedText,
        selectedFont,
        typedFontSize,
        typedColor,
        bg
      );
    } else if (mode === 'upload' && uploadImgEl) {
      finalCanvas = await extractPaperSignature(
        uploadImgEl,
        paperThreshold,
        uploadInkColor,
        bg
      );
    }

    if (!finalCanvas) return;

    const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    finalCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const filename = `signature_${Date.now()}.${exportFormat}`;
        downloadBlob(blob, filename);
      },
      mime,
      0.95
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Signature Maker
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Create a crisp, transparent digital signature for PDF forms, contracts, and job offers. Draw by hand, type with natural cursive scripts, or extract dark ink from a photo of paper.
        </p>

        {/* Legal Disclaimer */}
        <div className="mt-4 p-3 rounded-lg bg-[#F4F6FA] border border-[#E7EAF0] text-xs text-[#687386] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[#5278F5] shrink-0 mt-0.5" />
          <span>
            <strong>Document Utility Notice:</strong> This tool generates a high-resolution visual signature image for placing onto documents. It does not provide cryptographic identity certification or legally authenticated digital keys.
          </span>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex border-b border-[#E7EAF0] gap-2">
        {[
          { id: 'draw', label: 'Draw Signature', icon: PenTool },
          { id: 'type', label: 'Type Signature', icon: Type },
          { id: 'upload', label: 'Upload Paper Signature', icon: Upload },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = mode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id as SignatureMode)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px ${
                isActive
                  ? 'border-[#5278F5] text-[#5278F5]'
                  : 'border-transparent text-[#687386] hover:text-[#182230]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Container */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
        {/* --- METHOD A: DRAW --- */}
        {mode === 'draw' && (
          <div className="space-y-4">
            {/* Drawing Canvas */}
            <div className="relative w-full h-64 sm:h-72 bg-[#F4F6FA] border-2 border-dashed border-[#5278F5]/40 rounded-xl overflow-hidden shadow-inner">
              <canvas
                ref={drawCanvasRef}
                width={1200}
                height={500}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-full h-full cursor-crosshair touch-none"
                style={{ touchAction: 'none' }}
              />

              {strokes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-[#687386]">
                  <span>Sign here using your mouse, trackpad, or finger</span>
                </div>
              )}
            </div>

            {/* Drawing Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-4">
                {/* Pen Width */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#182230]">Stroke:</span>
                  {[2, 3, 5].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setPenWidth(w)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                        penWidth === w
                          ? 'bg-[#5278F5] text-white border-[#5278F5]'
                          : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                      }`}
                    >
                      {w === 2 ? 'Fine' : w === 3 ? 'Medium' : 'Bold'}
                    </button>
                  ))}
                </div>

                {/* Ink Color */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#182230]">Ink:</span>
                  {SIGNATURE_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setPenColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        penColor === c.hex ? 'border-[#5278F5] scale-110 shadow-xs' : 'border-white'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Undo & Clear */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={strokes.length === 0}
                  onClick={handleUndo}
                  className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#182230] flex items-center gap-1.5 disabled:opacity-30"
                >
                  <Undo className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  disabled={strokes.length === 0}
                  onClick={handleClearDraw}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#E05252] hover:bg-red-50 flex items-center gap-1 disabled:opacity-30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- METHOD B: TYPE --- */}
        {mode === 'type' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Type your name or signature
                </label>
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full h-11 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-sm text-[#182230] focus:outline-none focus:border-[#5278F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Handwriting Script Font
                </label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="w-full h-11 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                >
                  {SIGNATURE_FONTS.map((f) => (
                    <option key={f.id} value={f.font}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color & Size Sliders */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#182230]">Ink Color:</span>
                {SIGNATURE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setTypedColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      typedColor === c.hex ? 'border-[#5278F5] scale-110 shadow-xs' : 'border-white'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[#182230]">Size:</span>
                <input
                  type="range"
                  min="32"
                  max="96"
                  value={typedFontSize}
                  onChange={(e) => setTypedFontSize(Number(e.target.value))}
                  className="w-32 accent-[#5278F5]"
                />
              </div>
            </div>

            {/* Live Type Preview */}
            <div className="w-full h-44 bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl flex items-center justify-center p-4 overflow-hidden">
              <span
                style={{
                  fontFamily: selectedFont,
                  fontSize: `${typedFontSize}px`,
                  color: typedColor,
                }}
                className="select-none tracking-normal leading-none"
              >
                {typedText || 'Your Signature'}
              </span>
            </div>
          </div>
        )}

        {/* --- METHOD C: UPLOAD --- */}
        {mode === 'upload' && (
          <div className="space-y-4">
            {!uploadImgEl ? (
              <UploadArea
                accept="image/*"
                title="Drop a photo of your paper signature"
                subtitle="Sign on clean white paper with a pen, then take a photo"
                onFilesSelected={handleSignatureUpload}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-[#687386]">
                  <span>Uploaded paper photo processed</span>
                  <button
                    onClick={() => {
                      setUploadImgEl(null);
                      setUploadedFile(null);
                    }}
                    className="text-[#E05252] hover:underline"
                  >
                    Upload another photo
                  </button>
                </div>

                {/* Tuner for paper threshold */}
                <div className="p-4 bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#182230]">Paper Removal Sensitivity</span>
                    <span className="font-mono text-[#5278F5] font-semibold">{paperThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="120"
                    max="240"
                    value={paperThreshold}
                    onChange={(e) => setPaperThreshold(Number(e.target.value))}
                    className="w-full accent-[#5278F5] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[#687386]">
                    <span>Preserve fine ink details</span>
                    <span>Remove more background shadows</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Export Bar */}
        <div className="pt-6 border-t border-[#E7EAF0] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#182230]">Export Format:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setExportFormat('png')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  exportFormat === 'png'
                    ? 'bg-[#5278F5] text-white border-[#5278F5]'
                    : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                }`}
              >
                PNG (Transparent)
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('jpg')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  exportFormat === 'jpg'
                    ? 'bg-[#5278F5] text-white border-[#5278F5]'
                    : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                }`}
              >
                JPEG (White background)
              </button>
            </div>
          </div>

          <button
            onClick={handleDownloadSignature}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Signature ({exportFormat.toUpperCase()})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
