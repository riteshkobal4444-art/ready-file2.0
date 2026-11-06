import React from 'react';
import { FileText, Shield, Sparkles, Check, ArrowUpRight } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const handleNav = (path: string) => {
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#FFFFFF] border-t border-[#E7EAF0] text-[#182230] pt-14 pb-12 mt-20">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[#E7EAF0]">
          {/* Brand & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#5278F5] flex items-center justify-center text-white">
                <FileText className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg tracking-tight text-[#182230]">
                READYFILE
              </span>
            </div>
            <p className="text-sm text-[#687386] max-w-sm leading-relaxed">
              Every document. Ready to submit. A free, clean online document preparation platform built with speed, precision, and privacy at its core.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#24B47E] font-medium pt-1">
              <Shield className="w-4 h-4 text-[#24B47E]" />
              <span>Zero server uploads. 100% private browser processing.</span>
            </div>
            <p className="text-[11px] text-[#687386] max-w-sm leading-normal pt-1">
              Privacy Promise: Files never leave your device. Anonymized performance analytics (Google Analytics & Vercel Analytics) help us maintain app health without collecting document data, file names, or personal identities.
            </p>
          </div>

          {/* Column 1: Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#687386] mb-4">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => handleNav('/')}
                  className="text-[#182230] hover:text-[#5278F5] transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/tools')}
                  className="text-[#182230] hover:text-[#5278F5] transition-colors"
                >
                  All Tools (20)
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/pdf-tools')}
                  className="text-[#182230] hover:text-[#5278F5] transition-colors"
                >
                  PDF Tools
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/image-tools')}
                  className="text-[#182230] hover:text-[#5278F5] transition-colors"
                >
                  Image Tools
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/video-tools')}
                  className="text-[#182230] hover:text-[#5278F5] transition-colors"
                >
                  Video Tools
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/guides')}
                  className="text-[#182230] hover:text-[#5278F5] transition-colors"
                >
                  Guides & Tutorials
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: PDF Tools */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#687386] mb-4">
              PDF Tools (6)
            </h4>
            <ul className="space-y-2 text-xs">
              {[
                { name: 'PDF Merger', slug: 'pdf-merger' },
                { name: 'PDF Splitter', slug: 'pdf-splitter' },
                { name: 'PDF Compressor', slug: 'pdf-compressor' },
                { name: 'PDF to Images', slug: 'pdf-to-images' },
                { name: 'Rotate PDF', slug: 'rotate-pdf' },
                { name: 'Reorder PDF Pages', slug: 'reorder-pdf' },
              ].map((t) => (
                <li key={t.slug}>
                  <button
                    onClick={() => handleNav(`/tool/${t.slug}`)}
                    className="text-[#182230] hover:text-[#5278F5] transition-colors flex items-center gap-1.5"
                  >
                    <span>{t.name}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#24B47E]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Video & Doc Tools */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#687386] mb-4">
              Video & Doc Tools (7)
            </h4>
            <ul className="space-y-2 text-xs">
              {[
                { name: 'Video Compressor', slug: 'video-compressor' },
                { name: 'Video Trimmer', slug: 'video-trimmer' },
                { name: 'Video Muter', slug: 'video-muter' },
                { name: 'Thumbnail Maker', slug: 'video-thumbnail-maker' },
                { name: 'Frame Extractor', slug: 'video-frame-extractor' },
                { name: 'Requirement Checker', slug: 'file-checker' },
                { name: 'Checklist Builder', slug: 'checklist-builder' },
              ].map((t) => (
                <li key={t.slug}>
                  <button
                    onClick={() => handleNav(`/tool/${t.slug}`)}
                    className="text-[#182230] hover:text-[#5278F5] transition-colors flex items-center gap-1.5"
                  >
                    <span>{t.name}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#24B47E]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#687386]">
          <p>© {new Date().getFullYear()} READYFILE. Free online document utilities. No registration required.</p>
          <div className="flex items-center gap-6">
            <span>Client-side Processing</span>
            <span>No Account Needed</span>
            <span>Free Forever</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
