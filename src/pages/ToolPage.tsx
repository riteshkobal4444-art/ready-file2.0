import React from 'react';
import { getToolBySlug } from '../data/tools';
import { Breadcrumb } from '../components/Breadcrumb';
import { ImageCompressor } from '../tools/ImageCompressor';
import { ImageResizer } from '../tools/ImageResizer';
import { ImageToPdf } from '../tools/ImageToPdf';
import { PdfMerger } from '../tools/PdfMerger';
import { RequirementChecker } from '../tools/RequirementChecker';
import { ImageCropper } from '../tools/ImageCropper';
import { ImageConverter } from '../tools/ImageConverter';
import { PassportPhoto } from '../tools/PassportPhoto';
import { SignatureMaker } from '../tools/SignatureMaker';
import { PdfSplitter } from '../tools/PdfSplitter';
import { ComingSoonView } from '../components/ComingSoonView';
import { ToolItem } from '../types';

interface ToolPageProps {
  toolSlug: string;
  onNavigate: (path: string) => void;
  onSelectTool: (tool: ToolItem) => void;
}

export const ToolPage: React.FC<ToolPageProps> = ({
  toolSlug,
  onNavigate,
  onSelectTool,
}) => {
  const tool = getToolBySlug(toolSlug);

  if (!tool) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl text-[#182230]">
          Tool Not Found
        </h2>
        <p className="text-sm text-[#687386]">
          The document utility you requested does not exist or has been moved.
        </p>
        <button
          onClick={() => onNavigate('/tools')}
          className="px-5 py-2.5 rounded-lg bg-[#5278F5] text-white text-xs font-semibold"
        >
          View All Tools
        </button>
      </div>
    );
  }

  // If Coming Soon, render the approved informational preview
  if (tool.status === 'coming_soon') {
    return <ComingSoonView tool={tool} onNavigate={onNavigate} />;
  }

  const categoryPath =
    tool.category === 'image'
      ? '/image-tools'
      : tool.category === 'pdf'
      ? '/pdf-tools'
      : '/tools';

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <Breadcrumb
        items={[
          { label: 'Tools', path: '/tools' },
          { label: tool.categoryName, path: categoryPath },
          { label: tool.name },
        ]}
        onNavigate={onNavigate}
      />

      {tool.slug === 'image-compressor' && (
        <ImageCompressor onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'image-resizer' && (
        <ImageResizer onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'image-to-pdf' && (
        <ImageToPdf onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'pdf-merger' && (
        <PdfMerger onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'file-checker' && (
        <RequirementChecker onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'image-cropper' && (
        <ImageCropper onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'image-converter' && (
        <ImageConverter onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'passport-photo' && (
        <PassportPhoto onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'signature-maker' && (
        <SignatureMaker />
      )}

      {tool.slug === 'pdf-splitter' && (
        <PdfSplitter onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}
    </div>
  );
};
