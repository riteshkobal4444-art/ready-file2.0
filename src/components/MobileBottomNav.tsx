import React from 'react';
import { 
  Home, 
  Layers, 
  FileStack, 
  FileImage, 
  BookOpen 
} from 'lucide-react';

interface MobileBottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const isNavActive = (itemPath: string, currentPath: string): boolean => {
  if (itemPath === '/') {
    return currentPath === '/' || currentPath === '';
  }
  if (itemPath === '/tools') {
    return (
      currentPath === '/tools' ||
      currentPath === '/tool/file-checker' ||
      currentPath === '/tool/checklist-builder'
    );
  }
  if (itemPath === '/pdf-tools') {
    return (
      currentPath === '/pdf-tools' ||
      [
        'pdf-merger',
        'pdf-splitter',
        'pdf-compressor',
        'pdf-to-images',
        'rotate-pdf',
        'reorder-pdf',
      ].some((s) => currentPath === `/tool/${s}`)
    );
  }
  if (itemPath === '/image-tools') {
    return (
      currentPath === '/image-tools' ||
      [
        'image-compressor',
        'image-resizer',
        'image-to-pdf',
        'image-cropper',
        'image-converter',
        'passport-photo',
        'signature-maker',
      ].some((s) => currentPath === `/tool/${s}`)
    );
  }
  if (itemPath === '/guides') {
    return currentPath.startsWith('/guides');
  }
  return currentPath.startsWith(itemPath);
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath, onNavigate }) => {
  const items = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Tools', path: '/tools', icon: Layers },
    { label: 'PDF', path: '/pdf-tools', icon: FileStack },
    { label: 'Images', path: '/image-tools', icon: FileImage },
    { label: 'Guides', path: '/guides', icon: BookOpen },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF] border-t border-[#E7EAF0] shadow-[0_-2px_12px_0_rgba(24,34,48,0.06)] px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {items.map((item) => {
          const active = isNavActive(item.path, currentPath);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => {
                onNavigate(item.path);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors relative select-none ${
                active
                  ? 'text-[#5278F5]'
                  : 'text-[#687386] hover:text-[#182230]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <div
                className={`w-9 h-7 rounded-full flex items-center justify-center transition-colors ${
                  active ? 'bg-[#5278F5]/10 text-[#5278F5]' : 'text-[#687386]'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
              </div>
              <span
                className={`text-[11px] font-medium tracking-tight mt-0.5 ${
                  active ? 'text-[#5278F5] font-semibold' : 'text-[#687386]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
