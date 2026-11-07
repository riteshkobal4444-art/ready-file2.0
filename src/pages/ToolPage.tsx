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
import { PdfCompressor } from '../tools/PdfCompressor';
import { PdfToImages } from '../tools/PdfToImages';
import { RotatePdf } from '../tools/RotatePdf';
import { ReorderPdf } from '../tools/ReorderPdf';
import { PdfToWord } from '../tools/PdfToWord';
import { PdfFormFiller } from '../tools/PdfFormFiller';
import { PdfWatermark } from '../tools/PdfWatermark';
import { ChecklistBuilder } from '../tools/ChecklistBuilder';
import { VideoCompressor } from '../tools/VideoCompressor';
import { VideoTrimmer } from '../tools/VideoTrimmer';
import { VideoMuter } from '../tools/VideoMuter';
import { VideoThumbnailMaker } from '../tools/VideoThumbnailMaker';
import { VideoFrameExtractor } from '../tools/VideoFrameExtractor';
import { ComingSoonView } from '../components/ComingSoonView';
import { ToolItem } from '../types';
import { trackToolOpen } from '../utils/analytics';

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

  React.useEffect(() => {
    if (tool) {
      trackToolOpen(tool.name, tool.categoryName || tool.category);
    }
  }, [tool?.slug]);

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
      : tool.category === 'video'
      ? '/video-tools'
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

      {tool.slug === 'pdf-compressor' && (
        <PdfCompressor onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'pdf-to-images' && (
        <PdfToImages onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'rotate-pdf' && (
        <RotatePdf />
      )}

      {tool.slug === 'reorder-pdf' && (
        <ReorderPdf onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'pdf-to-word' && (
        <PdfToWord onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'pdf-form-filler' && (
        <PdfFormFiller onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'pdf-watermark' && (
        <PdfWatermark onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'checklist-builder' && (
        <ChecklistBuilder />
      )}

      {tool.slug === 'video-compressor' && (
        <VideoCompressor onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'video-trimmer' && (
        <VideoTrimmer onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'video-muter' && (
        <VideoMuter onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'video-thumbnail-maker' && (
        <VideoThumbnailMaker onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}

      {tool.slug === 'video-frame-extractor' && (
        <VideoFrameExtractor onNavigateToTool={(slug) => onNavigate(`/tool/${slug}`)} />
      )}
    </div>
  );
};
