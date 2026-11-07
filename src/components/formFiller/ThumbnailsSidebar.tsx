import React from 'react';
import { PageInfo, FormElement } from '../../types/formFiller';
import { FileText, Layers } from 'lucide-react';

interface ThumbnailsSidebarProps {
  pages: PageInfo[];
  currentPageIndex: number;
  thumbnails: string[];
  elements: FormElement[];
  onSelectPage: (index: number) => void;
}

export const ThumbnailsSidebar: React.FC<ThumbnailsSidebarProps> = ({
  pages,
  currentPageIndex,
  thumbnails,
  elements,
  onSelectPage,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#FAFBFC] border-r border-[#E7EAF0] w-48 sm:w-56 shrink-0 overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-[#E7EAF0] flex items-center justify-between text-xs font-semibold text-[#182230]">
        <div className="flex items-center gap-1.5 text-[#5278F5]">
          <Layers className="w-3.5 h-3.5" />
          <span>Pages ({pages.length})</span>
        </div>
      </div>

      {/* Pages list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pages.map((page, idx) => {
          const isSelected = idx === currentPageIndex;
          const thumb = thumbnails[idx];
          const pageElementsCount = elements.filter((el) => el.pageIndex === idx).length;

          return (
            <button
              key={page.pageIndex}
              onClick={() => onSelectPage(idx)}
              className={`w-full text-left rounded-xl p-2 transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                isSelected
                  ? 'bg-white ring-2 ring-[#5278F5] shadow-xs'
                  : 'hover:bg-white/80 border border-[#E7EAF0]'
              }`}
            >
              {/* Thumbnail Frame */}
              <div className="w-full aspect-3/4 max-h-36 bg-white border border-[#E7EAF0] rounded-lg overflow-hidden flex items-center justify-center relative shadow-2xs">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="flex flex-col items-center text-[#8A94A6] gap-1">
                    <FileText className="w-6 h-6 stroke-[1.5]" />
                    <span className="text-[10px]">Page {idx + 1}</span>
                  </div>
                )}

                {/* Badge showing elements on this page */}
                {pageElementsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#5278F5] text-white shadow-xs">
                    {pageElementsCount}
                  </span>
                )}
              </div>

              {/* Page Number & Info */}
              <div className="w-full flex items-center justify-between text-[11px] px-1">
                <span className={`font-semibold ${isSelected ? 'text-[#5278F5]' : 'text-[#687386]'}`}>
                  Page {idx + 1}
                </span>
                <span className="text-[10px] text-[#8A94A6]">
                  {Math.round(page.width)}×{Math.round(page.height)} pt
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
