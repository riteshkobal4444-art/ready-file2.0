import React, { useState } from 'react';
import { Search, Filter, Layers, CheckCircle2, Clock } from 'lucide-react';
import { ToolCard } from '../components/ToolCard';
import { TOOLS } from '../data/tools';
import { ToolItem } from '../types';
import { Breadcrumb } from '../components/Breadcrumb';

interface AllToolsProps {
  onNavigate: (path: string) => void;
  onSelectTool: (tool: ToolItem) => void;
}

export const AllTools: React.FC<AllToolsProps> = ({ onNavigate, onSelectTool }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'active' | 'image' | 'pdf' | 'doc'>('all');

  const filteredTools = TOOLS.filter((tool) => {
    // Search query match
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.categoryName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterCategory === 'all') return true;
    if (filterCategory === 'active') return tool.status === 'active';
    return tool.category === filterCategory;
  });

  const activeCount = TOOLS.filter((t) => t.status === 'active').length;
  const comingSoonCount = TOOLS.filter((t) => t.status === 'coming_soon').length;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-12">
      <Breadcrumb items={[{ label: 'All Tools' }]} onNavigate={onNavigate} />

      {/* Header & Search */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 shadow-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#5278F5] mb-1">
            Readyfile Utility Suite (Version 1.2)
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] tracking-tight mb-2">
            All Document Tools ({TOOLS.length})
          </h1>
          <p className="text-sm text-[#687386] max-w-xl">
            Explore {activeCount} fully functional tools and preview {comingSoonCount} upcoming tools engineered to make document preparation and submission stress-free.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#687386] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] placeholder:text-[#687386] focus:outline-none focus:border-[#5278F5]"
          />
        </div>
      </div>

      {/* Category Pills & Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E7EAF0] pb-4">
        {[
          { id: 'all', label: `All Tools (${TOOLS.length})` },
          { id: 'active', label: `Active Now (${activeCount})` },
          { id: 'image', label: `Image Tools (${TOOLS.filter((t) => t.category === 'image').length})` },
          { id: 'pdf', label: `PDF Tools (${TOOLS.filter((t) => t.category === 'pdf').length})` },
          { id: 'doc', label: `Document Preparation (${TOOLS.filter((t) => t.category === 'doc').length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterCategory(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterCategory === tab.id
                ? 'bg-[#5278F5] text-white shadow-xs'
                : 'bg-[#FFFFFF] border border-[#E7EAF0] text-[#687386] hover:bg-[#F4F6FA] hover:text-[#182230]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-[#687386]">
        <span>
          Showing {filteredTools.length} of {TOOLS.length} tools
        </span>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[#24B47E]">
            <span className="w-2 h-2 rounded-full bg-[#24B47E]" />
            {activeCount} Functional
          </span>
          <span className="inline-flex items-center gap-1 text-[#687386]">
            <span className="w-2 h-2 rounded-full bg-[#C4C5D6]" />
            {comingSoonCount} Coming Soon
          </span>
        </div>
      </div>

      {/* Tools Grid */}
      {filteredTools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onSelect={onSelectTool} />
          ))}
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-12 text-center">
          <p className="text-sm font-medium text-[#182230] mb-1">No matching tools found</p>
          <p className="text-xs text-[#687386] mb-4">
            Try adjusting your search query or switching categories.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterCategory('all');
            }}
            className="px-4 py-2 rounded-lg bg-[#F4F6FA] text-xs font-medium text-[#5278F5] hover:bg-[#E7EAF0]"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
