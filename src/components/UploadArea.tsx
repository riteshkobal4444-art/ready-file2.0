import React, { useRef, useState } from 'react';
import { UploadCloud, File, AlertCircle } from 'lucide-react';

interface UploadAreaProps {
  accept?: string;
  multiple?: boolean;
  title?: string;
  subtitle?: string;
  maxSizeMB?: number;
  onFilesSelected: (files: File[]) => void;
  allowedExtensions?: string[];
  disabled?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  accept = 'image/*,application/pdf',
  multiple = false,
  title = 'Drop your file here, or browse',
  subtitle = 'Supports common image and PDF formats',
  maxSizeMB = 50,
  onFilesSelected,
  allowedExtensions,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndForwardFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setDragError(null);

    const validFiles: File[] = [];
    const maxBytes = maxSizeMB * 1024 * 1024;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      if (file.size > maxBytes) {
        setDragError(`"${file.name}" exceeds the ${maxSizeMB} MB size limit.`);
        return;
      }

      if (allowedExtensions && allowedExtensions.length > 0) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !allowedExtensions.includes(ext)) {
          setDragError(
            `File type .${ext || 'unknown'} is not allowed. Please select ${allowedExtensions.map((e) => `.${e}`).join(', ')}`
          );
          return;
        }
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesSelected(multiple ? validFiles : [validFiles[0]]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    validateAndForwardFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && inputRef.current) {
            inputRef.current.click();
          }
        }}
        className={`relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
          isDragOver
            ? 'border-[#5278F5] bg-[#5278F5]/5 scale-[1.005]'
            : 'border-[#E7EAF0] bg-[#FFFFFF] hover:border-[#5278F5]/60 hover:bg-[#F4F6FA]/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            validateAndForwardFiles(e.target.files);
            // reset value so re-selecting same file triggers change
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-full bg-[#5278F5]/10 flex items-center justify-center text-[#5278F5] mb-4 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-7 h-7 stroke-[1.8]" />
        </div>

        <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base sm:text-lg text-[#182230] mb-1.5">
          {title}
        </h3>

        <p className="text-sm text-[#687386] max-w-md mb-5 leading-relaxed">
          {subtitle}
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-medium transition-colors shadow-sm">
          <span>{multiple ? 'Choose files' : 'Choose file'}</span>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-[#687386]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#24B47E]" />
          <span>Local browser processing — 100% private</span>
        </div>
      </div>

      {dragError && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-[#E05252] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{dragError}</span>
        </div>
      )}
    </div>
  );
};
