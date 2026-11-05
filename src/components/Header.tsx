import React from 'react';
import { FileText, ShieldCheck, ArrowRight } from 'lucide-react';
import { isNavActive } from './MobileBottomNav';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Tools', path: '/tools' },
    { label: 'PDF Tools', path: '/pdf-tools' },
    { label: 'Image Tools', path: '/image-tools' },
    { label: 'Guides', path: '/guides' },
  ];

  const handleNavClick = (path: string) => {
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E7EAF0] shadow-[0_1px_2px_0_rgba(24,34,48,0.03)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => handleNavClick('/')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
            aria-label="Readyfile Home"
          >
            <div className="w-9 h-9 rounded-lg bg-[#5278F5] flex items-center justify-center text-white shadow-sm group-hover:bg-[#4165DC] transition-colors">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg tracking-tight text-[#182230]">
                READYFILE
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-[#687386]">
                Doc Utility
              </span>
            </div>
          </button>

          {/* Desktop Navigation - Hidden on Mobile */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Desktop Navigation">
            {navItems.map((item) => {
              const active = isNavActive(item.path, currentPath);
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#F4F6FA] text-[#5278F5] font-semibold'
                      : 'text-[#687386] hover:text-[#182230] hover:bg-[#F4F6FA]'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Action / Privacy Tag (Desktop) & Privacy Chip (Mobile) */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-[#24B47E]/10 border border-[#24B47E]/20 text-[#24B47E] text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">100% In-Browser Privacy</span>
            <span className="sm:hidden text-[11px]">Private</span>
          </div>

          <button
            onClick={() => handleNavClick('/tools')}
            className="hidden lg:flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-medium transition-colors shadow-sm"
          >
            <span>Explore 15 Tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
