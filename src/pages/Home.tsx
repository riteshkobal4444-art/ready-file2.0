import React from 'react';
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  CheckCircle, 
  Layers, 
  FileStack, 
  Minimize2, 
  Maximize2, 
  FileImage, 
  BookOpen, 
  Lock,
  Sparkles
} from 'lucide-react';
import { ToolCard } from '../components/ToolCard';
import { TOOLS, getActiveTools } from '../data/tools';
import { GUIDES } from '../data/guides';
import { ToolItem } from '../types';

interface HomeProps {
  onNavigate: (path: string) => void;
  onSelectTool: (tool: ToolItem) => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigate, onSelectTool }) => {
  const activeTools = getActiveTools();
  const featuredGuides = GUIDES.slice(0, 3);

  return (
    <div className="space-y-20 pb-12">
      {/* Hero Section */}
      <section className="pt-10 sm:pt-16 pb-8 text-center max-w-4xl mx-auto px-4">
        {/* Subtle Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#5278F5]/10 border border-[#5278F5]/20 text-[#5278F5] text-xs font-semibold mb-6 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-[#24B47E]" />
          <span>Privacy First: All Files Processed 100% In Your Browser</span>
        </div>

        {/* Display Headline */}
        <h1 className="font-['Plus_Jakarta_Sans'] font-extrabold text-3xl sm:text-5xl lg:text-6xl text-[#182230] tracking-tight leading-[1.15] mb-5">
          Every document.{' '}
          <span className="text-[#5278F5] underline decoration-[#5278F5]/30 underline-offset-8">
            Ready to submit.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-[#687386] max-w-2xl mx-auto leading-relaxed mb-8">
          Free, fast, and private online document preparation tools. Compress and resize images, merge PDFs, convert scans to PDF, and check upload requirements without registration.
        </p>

        {/* Primary CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            onClick={() => onNavigate('/tools')}
            className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Explore All 15 Tools</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('/tool/file-checker')}
            className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-[#FFFFFF] border border-[#E7EAF0] hover:bg-[#F4F6FA] text-[#182230] text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <span>Check File Requirements</span>
          </button>
        </div>

        {/* Value pillars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 pt-8 border-t border-[#E7EAF0] text-left">
          <div className="p-2">
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230] block">
              100% Free
            </span>
            <span className="text-xs text-[#687386]">No subscriptions or hidden caps</span>
          </div>
          <div className="p-2">
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230] block">
              Zero Uploads
            </span>
            <span className="text-xs text-[#687386]">Runs directly in your browser</span>
          </div>
          <div className="p-2">
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230] block">
              Instant Speed
            </span>
            <span className="text-xs text-[#687386]">No waiting in remote queues</span>
          </div>
          <div className="p-2">
            <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230] block">
              No Account
            </span>
            <span className="text-xs text-[#687386]">Use immediately, no signup</span>
          </div>
        </div>
      </section>

      {/* Featured Working Tools */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#5278F5] mb-1">
              Version 1.2 Available Now ({activeTools.length} Active Tools)
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] tracking-tight">
              Active Document Utilities
            </h2>
          </div>
          <button
            onClick={() => onNavigate('/tools')}
            className="text-xs font-medium text-[#5278F5] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View all 15 planned tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onSelect={onSelectTool} />
          ))}
        </div>
      </section>

      {/* Categories Spotlight */}
      <section className="bg-[#F4F6FA] border-y border-[#E7EAF0] py-16">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] tracking-tight mb-2">
              Organized by Document Type
            </h2>
            <p className="text-sm text-[#687386]">
              Whether you need to fine-tune photo scans or compile formal PDF dossiers, Readyfile keeps your workflow clear.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Image Tools Category Card */}
            <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center mb-4">
                  <FileImage className="w-6 h-6" />
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mb-2">
                  Image Tools (7)
                </h3>
                <p className="text-xs text-[#687386] leading-relaxed mb-4">
                  Compress photos, adjust pixel dimensions, convert images into PDF, and upcoming passport photo tools.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0]">Compressor</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0]">Resizer</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0]">Image to PDF</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('/image-tools')}
                className="w-full py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-semibold text-[#182230] flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Explore Image Tools</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* PDF Tools Category Card */}
            <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center mb-4">
                  <FileStack className="w-6 h-6" />
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mb-2">
                  PDF Tools (6)
                </h3>
                <p className="text-xs text-[#687386] leading-relaxed mb-4">
                  Combine documents, split pages, compress heavy PDF files, and rotate orientations cleanly in memory.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0]">PDF Merger</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0]">PDF Splitter</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0]">Compressor</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('/pdf-tools')}
                className="w-full py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-semibold text-[#182230] flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Explore PDF Tools</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Document Preparation Category Card */}
            <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#24B47E]/10 text-[#24B47E] flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230] mb-2">
                  Doc Preparation (2)
                </h3>
                <p className="text-xs text-[#687386] leading-relaxed mb-4">
                  Inspect byte caps, pixel boundaries, and formats with our File Requirement Checker and upcoming Checklist Builder.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#24B47E]/10 text-[#24B47E] border border-[#24B47E]/20">Requirement Checker</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0]">Checklist Builder</span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('/tool/file-checker')}
                className="w-full py-2.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-semibold text-[#182230] flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Launch Requirement Checker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Resource Guides */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#5278F5] mb-1">
              Knowledge Base
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] tracking-tight">
              Document Preparation Guides
            </h2>
          </div>
          <button
            onClick={() => onNavigate('/guides')}
            className="text-xs font-medium text-[#5278F5] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View all 7 guides</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredGuides.map((guide) => (
            <div
              key={guide.id}
              onClick={() => onNavigate(`/guides/${guide.slug}`)}
              role="button"
              tabIndex={0}
              className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 hover:shadow-[0_4px_12px_0_rgba(24,34,48,0.06)] hover:border-[#5278F5]/30 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-[#687386] mb-3">
                  <span className="font-semibold text-[#5278F5]">{guide.category}</span>
                  <span>{guide.readTime}</span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#182230] mb-2 leading-snug">
                  {guide.title}
                </h3>
                <p className="text-xs text-[#687386] leading-relaxed line-clamp-3 mb-4">
                  {guide.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-[#E7EAF0] text-xs font-medium text-[#5278F5] flex items-center justify-between">
                <span>Read step-by-step guide</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Privacy Assurance Banner */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-2xl p-8 sm:p-12 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#24B47E]">
              <Lock className="w-4 h-4" />
              <span>Strict Data Integrity</span>
            </div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl text-[#182230]">
              Your documents never touch a cloud server.
            </h3>
            <p className="text-sm text-[#687386] leading-relaxed">
              READYFILE runs entirely in your browser using modern Web APIs. Tax returns, personal IDs, resumes, and confidential legal agreements are processed locally and discarded from memory when you close the tab.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigate('/tools')}
              className="px-6 py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Get Started Now
            </button>
            <button
              onClick={() => onNavigate('/guides')}
              className="px-6 py-3 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-[#182230] text-sm font-semibold transition-colors"
            >
              Read Submission Guides
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
