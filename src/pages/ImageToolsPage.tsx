import React from 'react';
import { FileImage, ShieldCheck, ArrowRight } from 'lucide-react';
import { ToolCard } from '../components/ToolCard';
import { getToolsByCategory } from '../data/tools';
import { ToolItem } from '../types';
import { Breadcrumb } from '../components/Breadcrumb';

interface ImageToolsPageProps {
  onNavigate: (path: string) => void;
  onSelectTool: (tool: ToolItem) => void;
}

export const ImageToolsPage: React.FC<ImageToolsPageProps> = ({ onNavigate, onSelectTool }) => {
  const imageTools = getToolsByCategory('image');
  const activeCount = imageTools.filter((t) => t.status === 'active').length;
  const comingSoonCount = imageTools.filter((t) => t.status === 'coming_soon').length;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-12">
      <Breadcrumb items={[{ label: 'Image Tools' }]} onNavigate={onNavigate} />

      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5278F5] mb-1">
            <FileImage className="w-4 h-4" />
            <span>Category: Image Tools</span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] tracking-tight mb-2">
            Image Preparation Tools ({imageTools.length})
          </h1>
          <p className="text-sm text-[#687386] max-w-xl">
            Optimized for passport photos, scans, certificates, and ID cards. Compress image weight, lock aspect ratios, and convert directly to PDF.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-[#24B47E]/10 border border-[#24B47E]/20 text-[#24B47E] font-medium">
            {activeCount} Active Now
          </span>
          <span className="px-3 py-1.5 rounded-full bg-[#F4F6FA] border border-[#E7EAF0] text-[#687386] font-medium">
            {comingSoonCount} Coming Soon
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {imageTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onSelect={onSelectTool} />
        ))}
      </div>
    </div>
  );
};
