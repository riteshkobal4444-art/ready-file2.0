import React, { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, Upload, PenLine, Check } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string, aspectRatio: number) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
  const [strokeThickness, setStrokeThickness] = useState<number>(2.5);
  const [strokeColor, setStrokeColor] = useState<string>('#182230');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedRatio, setUploadedRatio] = useState<number>(2.5);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'draw') {
      const timer = setTimeout(() => {
        clearCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, strokeThickness / 2, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeThickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPointRef.current = coords;
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image/png') && !file.type.includes('image/jpeg')) {
      alert('Please upload a PNG or JPEG image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setUploadedRatio(img.naturalWidth / img.naturalHeight || 2.5);
        setUploadedImage(result);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;

      // Trim whitespace from signature canvas to produce tight clean bounding box
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let hasPixels = false;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 10) {
            hasPixels = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!hasPixels) {
        return;
      }

      const pad = 12;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(canvas.width - cropX, (maxX - minX) + pad * 2);
      const cropH = Math.min(canvas.height - cropY, (maxY - minY) + pad * 2);

      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = cropW;
      trimmedCanvas.height = cropH;
      const trimmedCtx = trimmedCanvas.getContext('2d');
      if (!trimmedCtx) return;

      trimmedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      const dataUrl = trimmedCanvas.toDataURL('image/png');
      const ratio = cropW / cropH;
      onSave(dataUrl, ratio);
      onClose();
    } else {
      if (!uploadedImage) return;
      onSave(uploadedImage, uploadedRatio);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#E7EAF0] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7EAF0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center">
              <PenLine className="w-4 h-4" />
            </div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230]">
              Add Signature
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F4F6FA] text-[#687386] hover:text-[#182230] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#E7EAF0] bg-[#FAFBFC] px-6 pt-2">
          <button
            onClick={() => setActiveTab('draw')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'draw'
                ? 'border-[#5278F5] text-[#5278F5]'
                : 'border-transparent text-[#687386] hover:text-[#182230]'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Draw Signature</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-[#5278F5] text-[#5278F5]'
                : 'border-transparent text-[#687386] hover:text-[#182230]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'draw' ? (
            <div>
              {/* Drawing options bar */}
              <div className="flex items-center justify-between mb-3 text-xs">
                {/* Colors */}
                <div className="flex items-center gap-2">
                  <span className="text-[#687386] font-medium">Ink:</span>
                  {[
                    { color: '#182230', label: 'Dark Charcoal' },
                    { color: '#002B49', label: 'Navy Blue' },
                    { color: '#1E40AF', label: 'Royal Blue' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      onClick={() => setStrokeColor(item.color)}
                      style={{ backgroundColor: item.color }}
                      title={item.label}
                      className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                        strokeColor === item.color ? 'ring-2 ring-offset-2 ring-[#5278F5] scale-110' : ''
                      }`}
                    />
                  ))}
                </div>

                {/* Stroke thickness */}
                <div className="flex items-center gap-2">
                  <span className="text-[#687386] font-medium">Thickness:</span>
                  {[
                    { val: 1.8, label: 'Fine' },
                    { val: 2.8, label: 'Medium' },
                    { val: 4.2, label: 'Bold' },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setStrokeThickness(s.val)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        strokeThickness === s.val
                          ? 'bg-[#5278F5] text-white'
                          : 'bg-[#F4F6FA] text-[#687386] hover:bg-[#E7EAF0]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Clear canvas */}
                <button
                  onClick={clearCanvas}
                  className="text-xs text-[#DC2626] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>

              {/* Canvas area */}
              <div className="border border-dashed border-[#C4C5D6] rounded-xl bg-[#FAFBFC] overflow-hidden relative cursor-crosshair touch-none select-none">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={200}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-48 block"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-[#8A94A6]">
                    Sign your name above with mouse or finger
                  </div>
                )}
                {/* Signature baseline guide */}
                <div className="absolute bottom-8 left-8 right-8 border-b border-[#E7EAF0] pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-[#C4C5D6] hover:border-[#5278F5] rounded-xl p-8 text-center block cursor-pointer transition-colors bg-[#FAFBFC]">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleUploadFile}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-[#182230] mb-1">
                  Click to choose signature image
                </div>
                <div className="text-[11px] text-[#687386]">
                  Supports PNG (with transparency) or high-contrast JPEG
                </div>
              </label>

              {uploadedImage && (
                <div className="p-3 border border-[#E7EAF0] rounded-xl bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={uploadedImage}
                      alt="Uploaded Signature"
                      className="h-12 max-w-[160px] object-contain border border-[#E7EAF0] rounded bg-white p-1"
                    />
                    <div className="text-xs font-medium text-[#24B47E] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Signature ready</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="text-xs text-[#DC2626] hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 border-t border-[#E7EAF0] bg-[#FAFBFC] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#E7EAF0] hover:bg-white text-xs font-medium text-[#687386] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={activeTab === 'draw' ? !hasDrawn : !uploadedImage}
            className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${
              (activeTab === 'draw' ? hasDrawn : uploadedImage)
                ? 'bg-[#5278F5] hover:bg-[#4165DC] text-white cursor-pointer'
                : 'bg-[#E7EAF0] text-[#8A94A6] cursor-not-allowed'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Insert Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
};
