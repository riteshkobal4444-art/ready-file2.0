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
                  All Tools (15)
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
                  onClick={() => handleNav('/guides')}
                  className="text-[#182230] hover:text-[#5278F5] transition-colors"
                >
                  Guides & Tutorials
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Active Tools */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#687386] mb-4">
              Active Tools (10)
            </h4>
            <ul className="space-y-2 text-xs">
              {[
                { name: 'Image Compressor', slug: 'image-compressor' },
                { name: 'Image Resizer', slug: 'image-resizer' },
                { name: 'Image to PDF', slug: 'image-to-pdf' },
                { name: 'Image Cropper', slug: 'image-cropper' },
                { name: 'Format Converter', slug: 'image-converter' },
                { name: 'Passport Photo', slug: 'passport-photo' },
                { name: 'Signature Maker', slug: 'signature-maker' },
                { name: 'PDF Merger', slug: 'pdf-merger' },
                { name: 'PDF Splitter', slug: 'pdf-splitter' },
                { name: 'Requirement Checker', slug: 'file-checker' },
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

          {/* Column 3: Coming Soon Tools */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#687386] mb-4">
              Coming Soon (5)
            </h4>
            <ul className="space-y-2.5 text-xs text-[#687386]">
              <li>
                <button
                  onClick={() => handleNav('/tool/pdf-compressor')}
                  className="hover:text-[#182230] transition-colors"
                >
                  PDF Compressor
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/tool/pdf-to-images')}
                  className="hover:text-[#182230] transition-colors"
                >
                  PDF to Images
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/tool/rotate-pdf')}
                  className="hover:text-[#182230] transition-colors"
                >
                  Rotate PDF
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/tool/reorder-pdf')}
                  className="hover:text-[#182230] transition-colors"
                >
                  Reorder PDF Pages
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/tool/checklist-builder')}
                  className="hover:text-[#182230] transition-colors"
                >
                  Document Checklist Builder
                </button>
              </li>
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
