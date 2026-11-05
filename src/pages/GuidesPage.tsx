import React, { useState } from 'react';
import { BookOpen, Search, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import { GUIDES } from '../data/guides';
import { GuideItem } from '../types';
import { Breadcrumb } from '../components/Breadcrumb';

interface GuidesPageProps {
  onNavigate: (path: string) => void;
  onSelectGuide: (guide: GuideItem) => void;
}

export const GuidesPage: React.FC<GuidesPageProps> = ({ onNavigate, onSelectGuide }) => {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');

  const categories = ['All', 'Photos & IDs', 'Scanning & Uploads', 'Optimization', 'PDF Mastery', 'Fundamentals', 'Best Practices'];

  const filteredGuides = GUIDES.filter((g) => {
    const matchesSearch =
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.summary.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === 'All' || g.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-12">
      <Breadcrumb items={[{ label: 'Guides' }]} onNavigate={onNavigate} />

      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5278F5] mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Document Preparation Library</span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] tracking-tight mb-2">
            Guides & Preparation Knowledge
          </h1>
          <p className="text-sm text-[#687386] max-w-xl">
            Concise, practical instructions designed to help you prepare flawless documents for visas, job applications, government portals, and university admissions.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#687386] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search guides..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] placeholder:text-[#687386] focus:outline-none focus:border-[#5278F5]"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 border-b border-[#E7EAF0] pb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCat === cat
                ? 'bg-[#5278F5] text-white shadow-xs'
                : 'bg-[#FFFFFF] border border-[#E7EAF0] text-[#687386] hover:bg-[#F4F6FA] hover:text-[#182230]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGuides.map((guide) => (
          <div
            key={guide.id}
            onClick={() => onSelectGuide(guide)}
            role="button"
            tabIndex={0}
            className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 hover:shadow-[0_4px_14px_0_rgba(24,34,48,0.06)] hover:border-[#5278F5]/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-[#687386] mb-3">
                <span className="font-semibold text-[#5278F5]">{guide.category}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {guide.readTime}
                </span>
              </div>

              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#182230] group-hover:text-[#5278F5] transition-colors mb-2 leading-snug">
                {guide.title}
              </h3>

              <p className="text-xs text-[#687386] leading-relaxed line-clamp-3 mb-4">
                {guide.summary}
              </p>
            </div>

            <div className="pt-3 border-t border-[#E7EAF0] flex items-center justify-between text-xs">
              <span className="text-[#687386] font-medium">
                {guide.steps.length} Key Steps
              </span>
              <span className="font-semibold text-[#5278F5] group-hover:underline flex items-center gap-1">
                <span>Read Guide</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
