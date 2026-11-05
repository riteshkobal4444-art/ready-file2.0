import React from 'react';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

interface NotFoundProps {
  onNavigate: (path: string) => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center mx-auto">
        <FileQuestion className="w-8 h-8 stroke-[1.8]" />
      </div>

      <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-3xl text-[#182230]">
        Page Not Found
      </h1>

      <p className="text-sm text-[#687386] max-w-sm mx-auto leading-relaxed">
        The link you followed might be incorrect or the document utility may have been rearranged.
      </p>

      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={() => onNavigate('/')}
          className="px-5 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Go to Homepage</span>
        </button>

        <button
          onClick={() => onNavigate('/tools')}
          className="px-5 py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-semibold text-[#182230] transition-colors"
        >
          <span>Browse All 15 Tools</span>
        </button>
      </div>
    </div>
  );
};
