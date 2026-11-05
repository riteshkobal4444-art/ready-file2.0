import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate }) => {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-[#687386] mb-6 overflow-x-auto py-1">
      <button
        onClick={() => onNavigate('/')}
        className="flex items-center gap-1 hover:text-[#5278F5] transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Home</span>
      </button>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3.5 h-3.5 text-[#C4C5D6] shrink-0" />
            {item.path && !isLast ? (
              <button
                onClick={() => onNavigate(item.path!)}
                className="hover:text-[#5278F5] transition-colors whitespace-nowrap"
              >
                {item.label}
              </button>
            ) : (
              <span className={`whitespace-nowrap ${isLast ? 'text-[#182230] font-medium' : ''}`}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
