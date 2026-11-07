import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Upload, 
  Type, 
  Calendar, 
  CheckSquare, 
  PenTool, 
  Image as ImageIcon, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download, 
  ShieldCheck, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  ArrowLeft,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  FormElement, 
  PageInfo, 
  InteractiveFormField 
} from '../types/formFiller';
import { 
  inspectAndLoadPdf, 
  renderAllThumbnails, 
  renderPageDirectToCanvas, 
  exportFilledPdf 
} from '../services/pdfFormFillerService';
import { ThumbnailsSidebar } from '../components/formFiller/ThumbnailsSidebar';
import { PropertiesPanel } from '../components/formFiller/PropertiesPanel';
import { ElementOverlay } from '../components/formFiller/ElementOverlay';
import { SignatureModal } from '../components/formFiller/SignatureModal';
import { 
  trackToolOpen, 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';
import { formatBytes } from '../utils/fileHelpers';

interface PdfFormFillerProps {
  onNavigateToTool?: (slug: string) => void;
}

export const PdfFormFiller: React.FC<PdfFormFillerProps> = ({ onNavigateToTool }) => {
  // Screen mode: 'upload' | 'editor' | 'exported'
  const [screenMode, setScreenMode] = useState<'upload' | 'editor' | 'exported'>('upload');

  // Document state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [interactiveFields, setInteractiveFields] = useState<InteractiveFormField[]>([]);
  const [interactiveValues, setInteractiveValues] = useState<Record<string, string | boolean>>({});
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cached PDF.js document proxy
  const pdfjsDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Editor workspace elements & history
  const [elements, setElements] = useState<FormElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1.0); // 0.6 to 2.0
  const [history, setHistory] = useState<FormElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Canvas DOM elements
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const activeRenderTaskRef = useRef<any>(null);

  // Modals & Panels
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);
  const [showInteractivePanel, setShowInteractivePanel] = useState<boolean>(false);

  // Hidden image input
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Export results
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Analytics on tool mount
  useEffect(() => {
    trackToolOpen('PDF Form Filler', 'PDF Tools');
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (exportUrl) URL.revokeObjectURL(exportUrl);
      if (pdfjsDocRef.current) {
        try {
          pdfjsDocRef.current.cleanup();
        } catch {}
      }
    };
  }, [exportUrl]);

  // History stack management
  const pushHistory = useCallback((newElements: FormElement[]) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, newElements];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setElements(history[targetIndex]);
      setSelectedElementId(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setElements(history[targetIndex]);
      setSelectedElementId(null);
    }
  }, [history, historyIndex]);

  // Render current PDF page directly to the DOM canvas
  const renderCurrentPage = useCallback(async () => {
    const pdfjsDoc = pdfjsDocRef.current;
    const canvas = pageCanvasRef.current;
    if (!pdfjsDoc || !canvas || pages.length === 0) return;

    setIsRenderingPage(true);
    setErrorMessage(null);

    try {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Scale multiplier (1.4 * zoomScale * dpr) for crisp rendering
      const scale = 1.35 * zoomScale * dpr;
      await renderPageDirectToCanvas(pdfjsDoc, currentPageIndex + 1, canvas, scale);
    } catch (err: any) {
      console.error('[PDF Form Filler] Render error:', err);
      setErrorMessage(`Failed to render PDF page ${currentPageIndex + 1}: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsRenderingPage(false);
    }
  }, [currentPageIndex, zoomScale, pages.length]);

  // Trigger render on page switch or zoom
  useEffect(() => {
    if (screenMode === 'editor' && pdfjsDocRef.current) {
      renderCurrentPage();
    }
  }, [screenMode, currentPageIndex, zoomScale, renderCurrentPage]);

  // Handle PDF file upload & inspection
  const handlePdfFile = async (file: File) => {
    setErrorMessage(null);
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Please select a valid PDF file (.pdf).');
      return;
    }

    if (file.size === 0) {
      setErrorMessage('The selected PDF file is empty (0 bytes).');
      return;
    }

    setIsLoadingPdf(true);
    try {
      trackFileUpload('PDF Form Filler', 'PDF Tools', 'application/pdf');
      setSelectedFile(file);
      setFileName(file.name);
      setFileSize(file.size);

      const inspection = await inspectAndLoadPdf(file);
      setOriginalBytes(inspection.originalBytes);
      pdfjsDocRef.current = inspection.pdfjsDoc;
      setPageCount(inspection.pageCount);
      setPages(inspection.pages);
      setInteractiveFields(inspection.interactiveFields);

      // Populate interactive initial values
      const initVals: Record<string, string | boolean> = {};
      inspection.interactiveFields.forEach((f) => {
        initVals[f.name] = f.value;
      });
      setInteractiveValues(initVals);

      // Switch to editor
      setCurrentPageIndex(0);
      setElements([]);
      setHistory([[]]);
      setHistoryIndex(0);
      setSelectedElementId(null);
      setScreenMode('editor');

      // Generate thumbnails asynchronously using the same PDF.js proxy
      renderAllThumbnails(inspection.pdfjsDoc, inspection.pageCount).then((thumbs) => {
        setThumbnails(thumbs);
      });
    } catch (err: any) {
      trackProcessingFailed('PDF Form Filler', 'PDF Tools', err, 'application/pdf');
      setErrorMessage(err?.message || 'Failed to inspect PDF document.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Add a new element to current page
  const addElement = (elementData: Partial<FormElement>) => {
    const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newElement: FormElement = {
      id: newId,
      pageIndex: currentPageIndex,
      type: 'text',
      x: 0.15,
      y: 0.2,
      width: 0.32,
      height: 0.05,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#182230',
      textAlign: 'left',
      ...elementData,
    };

    const nextElements = [...elements, newElement];
    setElements(nextElements);
    setSelectedElementId(newId);
    pushHistory(nextElements);
  };

  // Toolbar actions
  const handleAddText = () => {
    addElement({
      type: 'text',
      text: 'New Text',
      width: 0.28,
      height: 0.045,
      fontSize: 13,
    });
  };

  const handleAddDate = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    addElement({
      type: 'date',
      text: `${dd}/${mm}/${yyyy}`,
      width: 0.22,
      height: 0.045,
      fontSize: 13,
      dateFormat: 'DD/MM/YYYY',
    });
  };

  const handleAddCheckbox = () => {
    addElement({
      type: 'checkbox',
      checked: true,
      checkboxStyle: 'check',
      width: 0.045,
      height: 0.035,
      color: '#182230',
    });
  };

  const handleSaveSignature = (dataUrl: string, aspectRatio: number) => {
    const width = 0.28;
    const height = Math.max(0.05, width / (aspectRatio || 2.5));
    addElement({
      type: 'signature',
      imageDataUrl: dataUrl,
      aspectRatio,
      width,
      height,
    });
  };

  const handleAddImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image/png') && !file.type.includes('image/jpeg')) {
      alert('Please upload a PNG or JPEG image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight || 1.5;
        const width = 0.25;
        const height = width / ratio;
        addElement({
          type: 'image',
          imageDataUrl: dataUrl,
          aspectRatio: ratio,
          width,
          height,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUpdateElement = (updated: FormElement) => {
    const nextElements = elements.map((el) => (el.id === updated.id ? updated : el));
    setElements(nextElements);
    pushHistory(nextElements);
  };

  const handleDeleteElement = (id: string) => {
    const nextElements = elements.filter((el) => el.id !== id);
    setElements(nextElements);
    if (selectedElementId === id) setSelectedElementId(null);
    pushHistory(nextElements);
  };

  const handleDuplicateElement = (el: FormElement) => {
    const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const duplicated: FormElement = {
      ...el,
      id: newId,
      x: Math.min(0.9 - el.width, el.x + 0.03),
      y: Math.min(0.9 - el.height, el.y + 0.03),
    };
    const nextElements = [...elements, duplicated];
    setElements(nextElements);
    setSelectedElementId(newId);
    pushHistory(nextElements);
  };

  // Keyboard shortcut listener (Delete, Backspace, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    if (screenMode !== 'editor') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        e.preventDefault();
        handleDeleteElement(selectedElementId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        setSelectedElementId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenMode, selectedElementId, handleUndo, handleRedo, elements]);

  // Export & Download Flow
  const handleExport = async () => {
    if (!originalBytes) {
      setErrorMessage('Original PDF document data is missing. Please reload the document.');
      return;
    }
    setIsExporting(true);
    setErrorMessage(null);
    try {
      trackProcessingStarted('PDF Form Filler', 'PDF Tools', 'application/pdf');
      const blob = await exportFilledPdf(originalBytes, elements, interactiveValues);
      
      if (!blob || blob.size === 0) {
        throw new Error('Export produced an empty PDF file.');
      }

      const url = URL.createObjectURL(blob);
      setExportBlob(blob);
      setExportUrl(url);
      trackProcessingSuccess('PDF Form Filler', 'PDF Tools', 'application/pdf');
      setScreenMode('exported');
    } catch (err: any) {
      console.error('[PDF Form Filler] Export error:', err);
      trackProcessingFailed('PDF Form Filler', 'PDF Tools', err, 'application/pdf');
      setErrorMessage(err?.message || 'Failed to generate filled PDF. Please check your elements and try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportUrl || !exportBlob) return;
    trackFileDownload('PDF Form Filler', 'PDF Tools', 'application/pdf');
    const a = document.createElement('a');
    a.href = exportUrl;
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}-filled.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;
  const currentElements = elements.filter((el) => el.pageIndex === currentPageIndex);

  // Compute page dimensions
  const basePageWidth = pages[currentPageIndex]?.width || 595;
  const basePageHeight = pages[currentPageIndex]?.height || 842;
  const displayWidth = Math.round(basePageWidth * 1.35 * zoomScale);
  const displayHeight = Math.round(basePageHeight * 1.35 * zoomScale);

  return (
    <div className="space-y-6">
      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleAddImageFile}
        className="hidden"
      />

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
      />

      {/* ========================================================= */}
      {/* SCREEN 1: UPLOAD SCREEN                                    */}
      {/* ========================================================= */}
      {screenMode === 'upload' && (
        <div className="max-w-4xl mx-auto space-y-8 py-4">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5278F5]/10 border border-[#5278F5]/20 text-[#5278F5] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Any PDF. Save It. Submit It.</span>
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] font-extrabold text-3xl sm:text-4xl text-[#182230] tracking-tight">
              PDF Form Filler
            </h1>
            <p className="text-base text-[#687386] max-w-xl mx-auto leading-relaxed">
              Fill out your PDF forms without printing or scanning. Add text, dates, checkmarks, signatures and images directly on your documents.
            </p>
          </div>

          <div className="bg-[#FFFFFF] border-2 border-dashed border-[#C4C5D6] hover:border-[#5278F5] transition-all rounded-2xl p-8 sm:p-12 text-center shadow-xs">
            <input
              type="file"
              id="pdf-upload-input"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePdfFile(f);
              }}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center mx-auto mb-5 shadow-xs">
              <Upload className="w-8 h-8 stroke-[1.8]" />
            </div>

            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mb-2">
              Select or Drop a PDF File to Fill
            </h3>
            <p className="text-xs text-[#687386] max-w-md mx-auto leading-relaxed mb-6">
              Works with standard forms, scanned documents, contracts, tax returns, job applications, and non-interactive PDFs.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <label
                htmlFor="pdf-upload-input"
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                {isLoadingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading Document...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Browse PDF File</span>
                  </>
                )}
              </label>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-[#687386]">
              <span>• Multi-page PDF support</span>
              <span>• Drag & drop anywhere</span>
              <span>• Works offline in memory</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl flex items-start gap-3 text-xs text-[#991B1B]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Error loading document: </span>
                {errorMessage}
              </div>
            </div>
          )}

          <div className="bg-[#FAFBFC] border border-[#E7EAF0] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-[#24B47E]/10 text-[#24B47E] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-xs text-[#182230]">
                  100% In-Browser Privacy
                </h4>
                <p className="text-xs text-[#687386]">
                  Your files are processed on your device. They are not uploaded to our servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 2: PDF DOCUMENT EDITOR WORKSPACE                   */}
      {/* ========================================================= */}
      {screenMode === 'editor' && (
        <div className="flex flex-col bg-[#FFFFFF] border border-[#E7EAF0] rounded-2xl shadow-sm overflow-hidden min-h-[780px]">
          {/* Top Control Toolbar */}
          <div className="border-b border-[#E7EAF0] bg-[#FFFFFF] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            {/* Left: Document info & Back */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (confirm('Discard changes and choose another PDF?')) {
                    setScreenMode('upload');
                    setSelectedFile(null);
                    setOriginalBytes(null);
                    setElements([]);
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-[#F4F6FA] text-[#687386] hover:text-[#182230] text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                title="Change File"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Change File</span>
              </button>

              <div className="h-5 w-px bg-[#E7EAF0]" />

              <div className="flex items-center gap-2 text-xs">
                <FileText className="w-4 h-4 text-[#5278F5]" />
                <span className="font-semibold text-[#182230] truncate max-w-[140px] sm:max-w-[220px]">
                  {fileName}
                </span>
                <span className="text-[11px] text-[#8A94A6]">
                  ({pageCount} {pageCount === 1 ? 'page' : 'pages'})
                </span>
              </div>
            </div>

            {/* Middle: Element Adding Tools */}
            <div className="flex items-center gap-1 bg-[#FAFBFC] p-1 rounded-xl border border-[#E7EAF0]">
              <button
                onClick={handleAddText}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white text-[#182230] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Add Text"
              >
                <Type className="w-3.5 h-3.5 text-[#5278F5]" />
                <span className="hidden md:inline">Text</span>
              </button>

              <button
                onClick={handleAddDate}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white text-[#182230] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Add Date"
              >
                <Calendar className="w-3.5 h-3.5 text-[#5278F5]" />
                <span className="hidden md:inline">Date</span>
              </button>

              <button
                onClick={handleAddCheckbox}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white text-[#182230] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Add Checkbox"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#5278F5]" />
                <span className="hidden md:inline">Check</span>
              </button>

              <button
                onClick={() => setIsSignatureModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white text-[#182230] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Add Signature"
              >
                <PenTool className="w-3.5 h-3.5 text-[#5278F5]" />
                <span className="hidden md:inline">Sign</span>
              </button>

              <button
                onClick={() => imageInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white text-[#182230] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Add Image or Stamp"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#5278F5]" />
                <span className="hidden md:inline">Image</span>
              </button>
            </div>

            {/* Right: Undo / Redo & Zoom & Export */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  title="Undo (Ctrl+Z)"
                  className={`p-1.5 rounded-lg transition-colors ${
                    historyIndex > 0
                      ? 'hover:bg-[#F4F6FA] text-[#182230] cursor-pointer'
                      : 'text-[#C4C5D6] cursor-not-allowed'
                  }`}
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  title="Redo (Ctrl+Y)"
                  className={`p-1.5 rounded-lg transition-colors ${
                    historyIndex < history.length - 1
                      ? 'hover:bg-[#F4F6FA] text-[#182230] cursor-pointer'
                      : 'text-[#C4C5D6] cursor-not-allowed'
                  }`}
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              <div className="h-5 w-px bg-[#E7EAF0]" />

              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center gap-1 bg-[#FAFBFC] p-0.5 rounded-lg border border-[#E7EAF0] text-xs">
                <button
                  onClick={() => setZoomScale((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
                  title="Zoom Out"
                  className="p-1 rounded hover:bg-white text-[#687386] hover:text-[#182230] cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-semibold text-[#182230] px-1.5 w-10 text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale((z) => Math.min(2.0, Math.round((z + 0.15) * 100) / 100))}
                  title="Zoom In"
                  className="p-1 rounded hover:bg-white text-[#687386] hover:text-[#182230] cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomScale(1.0)}
                  title="Fit 100%"
                  className="px-1.5 py-0.5 rounded text-[10px] text-[#687386] hover:bg-white hover:text-[#182230] cursor-pointer"
                >
                  100%
                </button>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Save & Export</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Interactive fields banner */}
          {interactiveFields.length > 0 && (
            <div className="bg-[#EFF6FF] border-b border-[#BFDBFE] px-4 py-2 flex items-center justify-between text-xs text-[#1E40AF]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3B82F6]" />
                <span>
                  Interactive PDF form detected ({interactiveFields.length} fillable fields). You can fill form fields and overlay signatures/text.
                </span>
              </div>
              <button
                onClick={() => setShowInteractivePanel(!showInteractivePanel)}
                className="underline font-semibold hover:text-[#1D4ED8] cursor-pointer"
              >
                {showInteractivePanel ? 'Hide Form Fields' : 'View Detected Fields'}
              </button>
            </div>
          )}

          {/* Interactive fields drawer */}
          {showInteractivePanel && (
            <div className="bg-[#FAFBFC] border-b border-[#E7EAF0] p-4 max-h-56 overflow-y-auto">
              <h4 className="text-xs font-bold text-[#182230] mb-2 uppercase tracking-wider">
                Detected Interactive Form Fields:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {interactiveFields.map((field) => (
                  <div key={field.name} className="p-2.5 bg-white border border-[#E7EAF0] rounded-lg">
                    <label className="block text-[11px] font-semibold text-[#687386] truncate mb-1">
                      {field.name}
                    </label>
                    {field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!interactiveValues[field.name]}
                          onChange={(e) =>
                            setInteractiveValues({
                              ...interactiveValues,
                              [field.name]: e.target.checked,
                            })
                          }
                          className="rounded text-[#5278F5]"
                        />
                        <span>Checked</span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={String(interactiveValues[field.name] || '')}
                        onChange={(e) =>
                          setInteractiveValues({
                            ...interactiveValues,
                            [field.name]: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1 border border-[#E7EAF0] rounded text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error notice if present */}
          {errorMessage && (
            <div className="p-3 bg-[#FEE2E2] border-b border-[#FCA5A5] flex items-center justify-between text-xs text-[#991B1B]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="underline font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Main workspace layout */}
          <div className="flex-1 flex overflow-hidden min-h-[640px]">
            {/* Left: Page Thumbnails Sidebar */}
            {isLeftSidebarOpen && (
              <ThumbnailsSidebar
                pages={pages}
                currentPageIndex={currentPageIndex}
                thumbnails={thumbnails}
                elements={elements}
                onSelectPage={(idx) => {
                  setCurrentPageIndex(idx);
                  setSelectedElementId(null);
                }}
              />
            )}

            {/* Center: Canvas Workspace Viewport */}
            <div
              onClick={() => setSelectedElementId(null)}
              className="flex-1 bg-[#F4F6FA] overflow-auto p-6 sm:p-8 flex items-center justify-center relative select-none"
            >
              {isRenderingPage && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-2xs flex items-center justify-center z-40">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E7EAF0] rounded-xl shadow-md text-xs font-semibold text-[#5278F5]">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rendering Page {currentPageIndex + 1}...</span>
                  </div>
                </div>
              )}

              {/* The Layered Page Container */}
              <div
                ref={canvasWrapperRef}
                style={{
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                }}
                className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#E7EAF0] rounded-sm relative select-none"
              >
                {/* Layer 1: Native HTML Canvas for PDF rendering */}
                <canvas
                  ref={pageCanvasRef}
                  className="w-full h-full block absolute inset-0 pointer-events-none"
                />

                {/* Layer 2 & 3: Overlay Elements & Interactions */}
                <div
                  className="absolute inset-0 w-full h-full"
                  onClick={() => setSelectedElementId(null)}
                >
                  {currentElements.map((el) => (
                    <ElementOverlay
                      key={el.id}
                      element={el}
                      containerWidth={displayWidth}
                      containerHeight={displayHeight}
                      isSelected={el.id === selectedElementId}
                      onSelect={() => setSelectedElementId(el.id)}
                      onUpdate={handleUpdateElement}
                      onDelete={() => handleDeleteElement(el.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Page navigation floating bottom bar */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xs border border-[#E7EAF0] shadow-lg rounded-full px-4 py-1.5 flex items-center gap-3 text-xs z-30">
                <button
                  onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                  disabled={currentPageIndex === 0}
                  className="p-1 rounded-full hover:bg-[#F4F6FA] text-[#182230] disabled:text-[#C4C5D6] cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-[#182230]">
                  Page {currentPageIndex + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setCurrentPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={currentPageIndex === pageCount - 1}
                  className="p-1 rounded-full hover:bg-[#F4F6FA] text-[#182230] disabled:text-[#C4C5D6] cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right: Properties Inspector Panel */}
            {isRightSidebarOpen && (
              <div className="w-72 sm:w-80 border-l border-[#E7EAF0] bg-white overflow-y-auto shrink-0">
                <PropertiesPanel
                  element={selectedElement}
                  onUpdateElement={handleUpdateElement}
                  onDeleteElement={handleDeleteElement}
                  onDuplicateElement={handleDuplicateElement}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCREEN 3: EXPORTED / DOWNLOAD RESULT SCREEN               */}
      {/* ========================================================= */}
      {screenMode === 'exported' && (
        <div className="max-w-2xl mx-auto space-y-6 py-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#24B47E]/10 text-[#24B47E] flex items-center justify-center mx-auto mb-2 shadow-xs">
            <CheckCircle2 className="w-8 h-8 stroke-[2]" />
          </div>

          <h2 className="font-['Plus_Jakarta_Sans'] font-extrabold text-2xl sm:text-3xl text-[#182230]">
            Your PDF is ready!
          </h2>
          <p className="text-sm text-[#687386] max-w-md mx-auto leading-relaxed">
            All inserted text, dates, checkmarks, signatures and images have been embedded directly into your original PDF document.
          </p>

          {/* Document summary card */}
          <div className="bg-white border border-[#E7EAF0] rounded-xl p-5 text-left max-w-md mx-auto shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold text-xs text-[#182230] truncate">
                  {fileName.replace(/\.[^/.]+$/, '')}-filled.pdf
                </div>
                <div className="text-[11px] text-[#687386]">
                  {pageCount} {pageCount === 1 ? 'page' : 'pages'} • {elements.length} added elements
                </div>
              </div>
            </div>

            {exportBlob && (
              <div className="text-[11px] text-[#687386] pt-2 border-t border-[#E7EAF0] flex justify-between">
                <span>Output File Size:</span>
                <span className="font-mono text-[#182230]">{formatBytes(exportBlob.size)}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Filled PDF</span>
            </button>

            <button
              onClick={() => setScreenMode('editor')}
              className="w-full sm:w-auto px-5 py-3 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#182230] cursor-pointer"
            >
              Return to Editing
            </button>
          </div>

          <div>
            <button
              onClick={() => {
                setScreenMode('upload');
                setSelectedFile(null);
                setOriginalBytes(null);
                setElements([]);
                setExportBlob(null);
                if (pdfjsDocRef.current) {
                  try {
                    pdfjsDocRef.current.cleanup();
                  } catch {}
                  pdfjsDocRef.current = null;
                }
              }}
              className="text-xs text-[#5278F5] hover:underline font-medium cursor-pointer"
            >
              Fill Another Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
