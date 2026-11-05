import React from 'react';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  Lightbulb, 
  ArrowRight,
  Sparkles,
  Share2
} from 'lucide-react';
import { GuideItem, ToolItem } from '../types';
import { getToolBySlug } from '../data/tools';
import { ToolCard } from '../components/ToolCard';
import { Breadcrumb } from '../components/Breadcrumb';

interface GuideDetailPageProps {
  guide: GuideItem;
  onNavigate: (path: string) => void;
  onSelectTool: (tool: ToolItem) => void;
}

export const GuideDetailPage: React.FC<GuideDetailPageProps> = ({
  guide,
  onNavigate,
  onSelectTool,
}) => {
  const relatedTools = guide.relatedToolSlugs
    .map((slug) => getToolBySlug(slug))
    .filter((t): t is ToolItem => !!t);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8 pb-16">
      <Breadcrumb
        items={[
          { label: 'Guides', path: '/guides' },
          { label: guide.title },
        ]}
        onNavigate={onNavigate}
      />

      {/* Article Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-10 shadow-sm">
        <div className="flex items-center gap-3 text-xs text-[#687386] mb-3">
          <span className="px-2.5 py-0.5 rounded-full font-semibold bg-[#5278F5]/10 text-[#5278F5] border border-[#5278F5]/20">
            {guide.category}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {guide.readTime}
          </span>
        </div>

        <h1 className="font-['Plus_Jakarta_Sans'] font-extrabold text-2xl sm:text-4xl text-[#182230] tracking-tight leading-tight mb-4">
          {guide.title}
        </h1>

        <p className="text-base sm:text-lg text-[#687386] leading-relaxed">
          {guide.summary}
        </p>
      </div>

      {/* Step by Step Content */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-10 shadow-sm space-y-8">
        <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-xl text-[#182230] border-b border-[#E7EAF0] pb-3">
          Step-by-Step Instructions
        </h2>

        <div className="space-y-8">
          {guide.steps.map((step, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-lg text-[#182230] flex items-baseline gap-2">
                <span>{step.title}</span>
              </h3>
              <p className="text-sm text-[#182230] leading-relaxed whitespace-pre-line pl-0.5">
                {step.description}
              </p>

              {step.tip && (
                <div className="p-3.5 rounded-lg bg-[#5278F5]/5 border border-[#5278F5]/20 text-xs text-[#182230] flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-[#5278F5] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#5278F5] font-semibold">Pro Tip: </strong>
                    <span>{step.tip}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Submission Checklist */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 shadow-sm">
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#24B47E]" />
          <span>Quick Verification Checklist</span>
        </h3>

        <div className="space-y-2.5">
          {guide.checklist.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-[#F4F6FA] border border-[#E7EAF0] flex items-start gap-3 text-xs text-[#182230]"
            >
              <div className="w-4 h-4 rounded-full bg-[#24B47E]/10 text-[#24B47E] flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className="leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Related Tools to take immediate action */}
      {relatedTools.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230]">
              Readyfile Tools for this Guide
            </h3>
            <span className="text-xs text-[#687386]">Execute your document preparation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {relatedTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onSelect={onSelectTool} />
            ))}
          </div>
        </div>
      )}

      {/* Back to Guides link */}
      <div className="pt-4 flex items-center justify-between">
        <button
          onClick={() => onNavigate('/guides')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5278F5] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Guides</span>
        </button>
      </div>
    </div>
  );
};
