import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Processing Error',
  message,
  onRetry,
  onDismiss,
}) => {
  return (
    <div className="bg-[#FFFFFF] border border-[#E05252]/30 rounded-xl p-5 my-4 shadow-[0_2px_8px_0_rgba(224,82,82,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#E05252]/10 text-[#E05252] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
              {title}
            </h4>
            <p className="text-xs text-[#687386] mt-1 leading-relaxed">
              {message}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-medium text-[#182230] transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Try again</span>
              </button>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[#687386] hover:text-[#182230] p-1 rounded-md"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
