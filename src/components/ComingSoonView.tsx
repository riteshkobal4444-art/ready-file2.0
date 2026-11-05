import React from 'react';
import { 
  Clock, 
  Sparkles, 
  Check, 
  ArrowLeft, 
  ShieldCheck, 
  ArrowRight,
  Layers
} from 'lucide-react';
import { ToolItem } from '../types';
import { Breadcrumb } from './Breadcrumb';

interface ComingSoonViewProps {
  tool: ToolItem;
  onNavigate: (path: string) => void;
}

export const ComingSoonView: React.FC<ComingSoonViewProps> = ({ tool, onNavigate }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumb
        items={[
          { label: 'Tools', path: '/tools' },
          { label: tool.categoryName, path: tool.category === 'image' ? '/image-tools' : tool.category === 'pdf' ? '/pdf-tools' : '/tools' },
          { label: tool.name },
        ]}
        onNavigate={onNavigate}
      />

      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-8 sm:p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center mx-auto mb-5">
          <Clock className="w-8 h-8 stroke-[1.8]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#5278F5]/10 text-[#5278F5] border border-[#5278F5]/20 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Planned for {tool.plannedRelease || 'Version 1.1'}</span>
        </div>

        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-3 tracking-tight">
          {tool.name}
        </h1>

        <p className="text-base text-[#687386] max-w-lg mx-auto leading-relaxed mb-8">
          {tool.description}
        </p>

        {/* Feature Highlights Planned */}
        {tool.features && tool.features.length > 0 && (
          <div className="max-w-md mx-auto text-left bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl p-6 mb-8">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#687386] mb-3">
              Planned Capabilities
            </h4>
            <ul className="space-y-2.5 text-xs text-[#182230]">
              {tool.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#24B47E]/10 text-[#24B47E] flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Architecture Note */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#687386] mb-8">
          <ShieldCheck className="w-4 h-4 text-[#24B47E]" />
          <span>Will adhere to Readyfile 100% In-Browser Privacy standard.</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('/tools')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#182230] flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Tools</span>
          </button>

          <button
            onClick={() => onNavigate(tool.category === 'image' ? '/image-tools' : '/pdf-tools')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span>Explore Active {tool.categoryName}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
