import React, { useState } from 'react';
import { 
  Download, 
  RotateCcw, 
  ArrowRight, 
  Check, 
  FileStack, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  Plus, 
  AlertTriangle,
  Lock,
  Layers
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectPdfFile, mergePdfFiles, PdfFileInfo } from '../services/pdfService';
import { formatBytes, downloadBlob } from '../utils/fileHelpers';

interface PdfMergerProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const PdfMerger: React.FC<PdfMergerProps> = ({ onNavigateToTool }) => {
  const [pdfItems, setPdfItems] = useState<PdfFileInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [mergedTotalPages, setMergedTotalPages] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    setError(null);
    setMergedBlob(null);
    setIsInspecting(true);

    const inspected: PdfFileInfo[] = [];
    const errorsEncountered: string[] = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        errorsEncountered.push(`"${file.name}" is not a PDF file.`);
        continue;
      }

      const info = await inspectPdfFile(file);
      if (!info.isValid) {
        errorsEncountered.push(`"${file.name}": ${info.error}`);
      } else {
        inspected.push(info);
      }
    }

    setIsInspecting(false);

    if (errorsEncountered.length > 0) {
      setError(errorsEncountered.join(' '));
    }

    if (inspected.length > 0) {
      setPdfItems((prev) => [...prev, ...inspected]);
    }
  };

  const handleRemove = (id: string) => {
    setPdfItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pdfItems.length) return;

    setPdfItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleMerge = async () => {
    if (pdfItems.length < 2) {
      setError('Please add at least 2 PDF documents to merge.');
      return;
    }

    // Check if any file is encrypted
    const encryptedFile = pdfItems.find((p) => p.isEncrypted);
    if (encryptedFile) {
      setError(`Cannot merge: "${encryptedFile.name}" is password-protected. Please unlock it before merging.`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const files = pdfItems.map((p) => p.file);
      const res = await mergePdfFiles(files);
      setMergedBlob(res.blob);
      setMergedTotalPages(res.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Merging failed. One of the documents may contain corrupted objects.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!mergedBlob) return;
    downloadBlob(mergedBlob, 'readyfile-merged.pdf');
  };

  const handleReset = () => {
    setPdfItems([]);
    setMergedBlob(null);
    setMergedTotalPages(0);
    setError(null);
  };

  const totalInputPages = pdfItems.reduce((acc, curr) => acc + curr.pageCount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          PDF Merger
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Combine multiple PDF files into one clean document. Drag or arrange your files into the exact order required for submission, view individual page counts, and merge securely in your browser.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {pdfItems.length === 0 && !isProcessing && (
        <UploadArea
          multiple
          accept="application/pdf,.pdf"
          allowedExtensions={['pdf']}
          title="Drop PDF files here to merge"
          subtitle="Select 2 or more PDF documents (Unencrypted)"
          onFilesSelected={handleFiles}
        />
      )}

      {isInspecting && <ProcessingState message="Validating and reading PDF page counts..." />}

      {/* PDF List & Reorder */}
      {pdfItems.length > 0 && !mergedBlob && !isProcessing && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                {pdfItems.length} Documents Selected
              </span>
              <p className="text-xs text-[#687386] mt-0.5">
                Total {totalInputPages} pages • {formatBytes(pdfItems.reduce((acc, curr) => acc + curr.size, 0))}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-medium text-[#182230] transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span>Add more PDFs</span>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,.pdf"
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

          {/* List of files in merge order */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl overflow-hidden divide-y divide-[#E7EAF0] shadow-sm">
            {pdfItems.map((item, index) => (
              <div
                key={item.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-[#F4F6FA]/50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center shrink-0 font-['Plus_Jakarta_Sans'] font-bold text-xs">
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#182230] truncate" title={item.name}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2.5 text-xs text-[#687386] mt-0.5">
                      <span className="font-mono">{formatBytes(item.size)}</span>
                      <span>•</span>
                      <span className="font-medium text-[#5278F5]">
                        {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                      </span>
                      {item.isEncrypted && (
                        <span className="inline-flex items-center gap-1 text-[#E05252]">
                          <Lock className="w-3 h-3" /> Password Protected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className="p-1.5 rounded text-[#687386] hover:text-[#5278F5] hover:bg-[#F4F6FA] disabled:opacity-25"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={index === pdfItems.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className="p-1.5 rounded text-[#687386] hover:text-[#5278F5] hover:bg-[#F4F6FA] disabled:opacity-25"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 rounded text-[#687386] hover:text-[#E05252] hover:bg-red-50"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Merge Trigger Button */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#687386]">
              Documents will be combined in the exact order shown above (1 to {pdfItems.length}).
            </div>

            <button
              onClick={handleMerge}
              disabled={pdfItems.length < 2}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span>Merge {pdfItems.length} PDFs ({totalInputPages} Pages)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && <ProcessingState message="Merging PDF documents and copying pages..." />}

      {/* Success Result State */}
      {mergedBlob && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Documents Merged Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Merge more files</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Input Files</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {pdfItems.length} PDFs
              </p>
            </div>

            <div className="bg-[#5278F5]/5 border border-[#5278F5]/20 rounded-lg p-4">
              <span className="text-xs text-[#5278F5] font-medium">Combined Page Count</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#5278F5] mt-0.5">
                {mergedTotalPages} Pages
              </p>
            </div>

            <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-4">
              <span className="text-xs text-[#687386]">Merged File Size</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mt-0.5">
                {formatBytes(mergedBlob.size)}
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#687386]">
              All vector text, fonts, and pages preserved directly in memory.
            </span>
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Merged PDF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
