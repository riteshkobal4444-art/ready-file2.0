import React, { useState, useEffect } from 'react';
import { 
  Images, 
  Download, 
  Archive, 
  RotateCcw, 
  Check, 
  Sliders, 
  Clock, 
  AlertTriangle,
  Play,
  FileImage,
  ArrowRight
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { 
  inspectVideoFile, 
  extractMultipleFrames, 
  createFramesZip, 
  formatTimecode, 
  VideoFileInfo, 
  ExtractedFrame 
} from '../services/videoService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';
import { 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';

interface VideoFrameExtractorProps {
  onNavigateToTool?: (slug: string) => void;
}

export const VideoFrameExtractor: React.FC<VideoFrameExtractorProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoFileInfo | null>(null);

  // Extraction Mode: 'interval' or 'count'
  const [mode, setMode] = useState<'interval' | 'count'>('count');
  const [intervalSec, setIntervalSec] = useState<number>(2);
  const [frameCount, setFrameCount] = useState<number>(10);
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [quality, setQuality] = useState<number>(0.9);

  // Extraction State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up Blob URLs on unmount or reset
  useEffect(() => {
    return () => {
      if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
      extractedFrames.forEach((f) => URL.revokeObjectURL(f.dataUrl));
    };
  }, [videoInfo, extractedFrames]);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setExtractedFrames([]);

    setIsProcessing(true);
    setProgressText('Inspecting video metadata...');
    const info = await inspectVideoFile(file);
    setIsProcessing(false);

    if (info.error) {
      setError(info.error);
      return;
    }

    setSelectedFile(file);
    setVideoInfo(info);
    trackFileUpload('video_frame_extractor', 'video', file.type || 'video/mp4');

    // Auto-adjust default frame count or interval based on duration
    if (info.duration > 60) {
      setIntervalSec(5);
      setFrameCount(12);
    } else if (info.duration > 20) {
      setIntervalSec(2);
      setFrameCount(10);
    } else {
      setIntervalSec(1);
      setFrameCount(8);
    }
  };

  const calculateTimestamps = (): number[] => {
    if (!videoInfo || videoInfo.duration <= 0) return [];
    const dur = videoInfo.duration;
    const timestamps: number[] = [];

    if (mode === 'interval') {
      const step = Math.max(0.5, intervalSec);
      for (let t = 0; t <= dur; t += step) {
        timestamps.push(t);
        if (timestamps.length >= 60) break; // Safeguard against memory overload
      }
    } else {
      const count = Math.max(2, Math.min(50, frameCount));
      const step = dur / (count + 1);
      for (let i = 1; i <= count; i++) {
        timestamps.push(i * step);
      }
    }

    return timestamps;
  };

  const estimatedCount = calculateTimestamps().length;

  const handleStartExtraction = async () => {
    if (!videoInfo || !selectedFile) return;
    const timestamps = calculateTimestamps();

    if (timestamps.length === 0) {
      setError('Unable to calculate timestamps for this video duration.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgressPercent(0);
    setProgressText(`Extracting frame 1 of ${timestamps.length}...`);
    trackProcessingStarted('video_frame_extractor', 'video');

    try {
      const frames = await extractMultipleFrames(
        videoInfo.previewUrl,
        timestamps,
        format,
        quality,
        (current, total) => {
          setProgressPercent(Math.round((current / total) * 100));
          setProgressText(`Extracting frame ${current} of ${total} (${Math.round((current / total) * 100)}%)...`);
        }
      );
      setExtractedFrames(frames);
      trackProcessingSuccess('video_frame_extractor', 'video');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to extract video frames.';
      setError(msg);
      trackProcessingFailed('video_frame_extractor', 'video', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingleFrame = (frame: ExtractedFrame) => {
    if (!selectedFile) return;
    const timeFormatted = frame.timestampLabel.replace(':', 'm').replace('.', 's_');
    const filename = sanitizeFileName(
      selectedFile.name,
      `_frame_${frame.index.toString().padStart(2, '0')}_${timeFormatted}`,
      format
    );
    downloadBlob(frame.blob, filename);
    trackFileDownload('video_frame_extractor', 'video', format === 'jpg' ? 'image/jpeg' : 'image/png');
  };

  const handleDownloadZip = async () => {
    if (extractedFrames.length === 0 || !selectedFile) return;
    setIsZipping(true);
    try {
      const zipBlob = await createFramesZip(extractedFrames, selectedFile.name, format);
      const zipName = sanitizeFileName(selectedFile.name, '_all_frames', 'zip');
      downloadBlob(zipBlob, zipName);
      trackFileDownload('video_frame_extractor', 'video', 'application/zip');
    } catch (err) {
      setError('Failed to create ZIP archive of extracted frames.');
    } finally {
      setIsZipping(false);
    }
  };

  const handleReset = () => {
    if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
    extractedFrames.forEach((f) => URL.revokeObjectURL(f.dataUrl));
    setSelectedFile(null);
    setVideoInfo(null);
    setExtractedFrames([]);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Video Frame Extractor
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Deconstruct videos into high-resolution still image sequences. Extract frames at fixed second intervals or evenly spaced across the entire timeline. Download individually or as a single ZIP bundle.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="video/*,.mp4,.mov,.webm,.m4v,.mkv"
          allowedExtensions={['mp4', 'mov', 'webm', 'm4v', 'mkv']}
          title="Drop video here to extract frames"
          subtitle="Supports MP4, MOV, WebM, and common video files"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full border-3 border-[#5278F5]/20 border-t-[#5278F5] animate-spin mx-auto" />
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
              {progressText}
            </h3>
            <p className="text-xs text-[#687386] mt-1">
              Rendering full-resolution video frames using browser Canvas memory.
            </p>
          </div>
          <div className="w-full max-w-md mx-auto bg-[#E7EAF0] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#5278F5] h-full transition-all duration-200 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Settings & Configuration Panel (Before extraction or for re-configuring) */}
      {selectedFile && videoInfo && !isProcessing && (
        <div className="space-y-6">
          {/* File summary bar */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                {videoInfo.name}
              </h3>
              <span className="text-xs text-[#687386]">
                {formatBytes(videoInfo.size)} • {videoInfo.width}×{videoInfo.height} ({videoInfo.aspectRatio}) • Duration: {formatTimecode(videoInfo.duration)}
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-[#687386] hover:text-[#E05252] self-start sm:self-auto transition-colors"
            >
              Choose different video
            </button>
          </div>

          {/* Configuration Card */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-7 space-y-6 shadow-sm">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-sm uppercase tracking-wider text-[#182230] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#5278F5]" />
              <span>Extraction Settings</span>
            </h3>

            {/* Mode selection tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('count')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  mode === 'count'
                    ? 'border-[#5278F5] bg-[#5278F5]/5 shadow-xs'
                    : 'border-[#E7EAF0] hover:bg-[#F4F6FA]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-['Plus_Jakarta_Sans'] font-semibold text-xs text-[#182230]">
                    By Total Frame Count
                  </span>
                  {mode === 'count' && <Check className="w-4 h-4 text-[#5278F5]" />}
                </div>
                <p className="text-[11px] text-[#687386]">
                  Sample evenly spaced frames across the whole video duration.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('interval')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  mode === 'interval'
                    ? 'border-[#5278F5] bg-[#5278F5]/5 shadow-xs'
                    : 'border-[#E7EAF0] hover:bg-[#F4F6FA]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-['Plus_Jakarta_Sans'] font-semibold text-xs text-[#182230]">
                    By Time Interval
                  </span>
                  {mode === 'interval' && <Check className="w-4 h-4 text-[#5278F5]" />}
                </div>
                <p className="text-[11px] text-[#687386]">
                  Extract a snapshot every fixed number of seconds (e.g., every 2s).
                </p>
              </button>
            </div>

            {/* Preset Options for Active Mode */}
            {mode === 'count' ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#182230]">
                  Number of Frames to Extract
                </label>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 30].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFrameCount(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        frameCount === c
                          ? 'bg-[#5278F5] text-white border-[#5278F5]'
                          : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                      }`}
                    >
                      {c} Frames
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#182230]">
                  Time Interval Between Frames
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Every 1s', val: 1 },
                    { label: 'Every 2s', val: 2 },
                    { label: 'Every 5s', val: 5 },
                    { label: 'Every 10s', val: 10 },
                  ].map((inv) => (
                    <button
                      key={inv.val}
                      type="button"
                      onClick={() => setIntervalSec(inv.val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        intervalSec === inv.val
                          ? 'bg-[#5278F5] text-white border-[#5278F5]'
                          : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                      }`}
                    >
                      {inv.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Format & Image Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#E7EAF0]">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Output Image Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat('jpg')}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      format === 'jpg'
                        ? 'bg-[#5278F5] text-white border-[#5278F5]'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                    }`}
                  >
                    JPG (Smaller size)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('png')}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      format === 'png'
                        ? 'bg-[#5278F5] text-white border-[#5278F5]'
                        : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                    }`}
                  >
                    PNG (Lossless)
                  </button>
                </div>
              </div>

              {format === 'jpg' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#182230]">Quality</span>
                    <span className="font-mono text-[#5278F5] font-semibold">{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.0"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full accent-[#5278F5] cursor-pointer mt-2"
                  />
                </div>
              )}
            </div>

            {/* Frame memory guardrail warning */}
            {estimatedCount > 35 && (
              <div className="p-3 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg text-xs text-[#687386] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  This will generate ~{estimatedCount} high-res images in browser memory. Recommended for devices with 4GB+ RAM.
                </span>
              </div>
            )}

            {/* Launch button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <span className="text-xs text-[#687386]">
                Will extract <strong>{estimatedCount}</strong> frames at {videoInfo.width}×{videoInfo.height} resolution.
              </span>

              <button
                type="button"
                onClick={handleStartExtraction}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>Extract {estimatedCount} Frames</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Results Grid Display */}
          {extractedFrames.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* Batch Action Toolbar */}
              <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230]">
                    {extractedFrames.length} Frames Extracted Successfully
                  </h4>
                  <span className="text-xs text-[#687386]">
                    Total weight: {formatBytes(extractedFrames.reduce((acc, f) => acc + f.size, 0))}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    disabled={isZipping}
                    className="px-4 py-2 rounded-lg bg-[#24B47E] hover:bg-[#1f9b6c] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Archive className="w-4 h-4" />
                    <span>{isZipping ? 'Bundling ZIP...' : 'Download All (ZIP)'}</span>
                  </button>
                </div>
              </div>

              {/* Grid of Extracted Frames */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {extractedFrames.map((frame) => (
                  <div
                    key={frame.id}
                    className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-2.5 flex flex-col justify-between shadow-xs hover:border-[#5278F5]/40 transition-colors group"
                  >
                    <div>
                      {/* Thumbnail Container */}
                      <div className="w-full h-32 bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center mb-2">
                        <img
                          src={frame.dataUrl}
                          alt={`Frame at ${frame.timestampLabel}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] mb-2 px-1">
                        <span className="font-mono font-bold text-[#5278F5]">
                          {frame.timestampLabel}
                        </span>
                        <span className="text-[#687386]">
                          {formatBytes(frame.size)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadSingleFrame(frame)}
                      className="w-full py-1.5 rounded-lg bg-[#F4F6FA] hover:bg-[#5278F5] text-[#182230] hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border border-[#E7EAF0] hover:border-[#5278F5]"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
