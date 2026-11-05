import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingStateProps {
  message?: string;
  submessage?: string;
}

export const ProcessingState: React.FC<ProcessingStateProps> = ({
  message = 'Processing your document...',
  submessage = 'Working locally in your browser. This takes just a moment.',
}) => {
  return (
    <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-10 sm:p-14 text-center flex flex-col items-center justify-center my-6">
      <div className="w-12 h-12 rounded-full bg-[#5278F5]/10 flex items-center justify-center text-[#5278F5] mb-4">
        <Loader2 className="w-6 h-6 animate-spin text-[#5278F5]" />
      </div>
      <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-lg text-[#182230] mb-1.5">
        {message}
      </h3>
      <p className="text-sm text-[#687386] max-w-sm">
        {submessage}
      </p>
    </div>
  );
};
