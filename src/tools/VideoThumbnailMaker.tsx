import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Download, 
  RotateCcw, 
  Check, 
  Sliders, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight,
  Maximize2,
  FileImage,
  Sparkles,
  Info
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { 
  inspectVideoFile, 
  captureFrameAtTime, 
  formatTimecode, 
  VideoFileInfo 
} from '../services/videoService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';
import { 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';

interface VideoThumbnailMakerProps {
  onNavigateToTool?: (slug: string) => void;
}

export const VideoThumbnailMaker: React.FC<VideoThumbnailMakerProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoFileInfo | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Settings
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [quality, setQuality] = useState<number>(0.92);

  // Captured frame preview
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string>('');
  const [capturedWidth, setCapturedWidth] = useState<number>(0);
  const [capturedHeight, setCapturedHeight] = useState<number>(0);
  const [capturedSize, setCapturedSize] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Clean up object URLs on unmount or reset
  useEffect(() => {
    return () => {
      if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [videoInfo, capturedUrl]);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setCapturedBlob(null);
    setCapturedUrl('');

    setIsProcessing(true);
    const info = await inspectVideoFile(file);
    setIsProcessing(false);

    if (info.error) {
      setError(info.error);
      return;
    }

    setSelectedFile(file);
    setVideoInfo(info);
    trackFileUpload('video_thumbnail_maker', 'video', file.type || 'video/mp4');
    setCurrentTime(0.5);

    // Initial capture at 0.5s or midpoint
    setTimeout(() => {
      if (videoRef.current) {
        handleCaptureFrame(0.5);
      }
    }, 400);
  };

  const handleTimeChange = (newTime: number) => {
    const clamped = Math.max(0, Math.min(videoInfo?.duration || 0, newTime));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleSeekShortcut = (ratio: number) => {
    if (!videoInfo) return;
    const target = ratio * videoInfo.duration;
    handleTimeChange(target);
    handleCaptureFrame(target);
  };

  const handleStep = (delta: number) => {
    handleTimeChange(currentTime + delta);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleCaptureFrame = async (timestamp?: number) => {
    if (!videoRef.current || !videoInfo) return;
    const t = typeof timestamp === 'number' ? timestamp : videoRef.current.currentTime;
    trackProcessingStarted('video_thumbnail_maker', 'video');

    try {
      const result = await captureFrameAtTime(videoRef.current, t, format, quality);
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);

      setCapturedBlob(result.blob);
      setCapturedUrl(result.dataUrl);
      setCapturedWidth(result.width);
      setCapturedHeight(result.height);
      setCapturedSize(result.size);
      trackProcessingSuccess('video_thumbnail_maker', 'video');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to capture frame from video.';
      setError(msg);
      trackProcessingFailed('video_thumbnail_maker', 'video', msg);
    }
  };

  const handleDownload = () => {
    if (!capturedBlob || !selectedFile) return;
    const timeFormatted = formatTimecode(currentTime).replace(':', 'm') + 's';
    const filename = sanitizeFileName(selectedFile.name, `_thumb_${timeFormatted}`, format);
    downloadBlob(capturedBlob, filename);
    trackFileDownload('video_thumbnail_maker', 'video', format === 'jpg' ? 'image/jpeg' : 'image/png');
  };

  const handleReset = () => {
    if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setSelectedFile(null);
    setVideoInfo(null);
    setCapturedBlob(null);
    setCapturedUrl('');
    setError(null);
    setIsPlaying(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Video Thumbnail Maker
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Scrub through any video and capture full-resolution cover photos, presentation stills, and social thumbnails with pixel precision. 100% private in-browser extraction.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="video/*,.mp4,.mov,.webm,.m4v,.mkv"
          allowedExtensions={['mp4', 'mov', 'webm', 'm4v', 'mkv']}
          title="Drop video file here to create thumbnails"
          subtitle="Supports MP4, WebM, MOV, and standard video formats"
          onFilesSelected={handleFiles}
        />
      )}

      {isProcessing && <ProcessingState message="Inspecting video streams and header..." />}

      {/* Active Workspace */}
      {selectedFile && videoInfo && (
        <div className="space-y-6">
          {/* File Overview Header */}
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Video Player & Scrubbing Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-[#000000] rounded-xl overflow-hidden shadow-sm relative flex items-center justify-center aspect-video max-h-[380px]">
                <video
                  ref={videoRef}
                  src={videoInfo.previewUrl}
                  playsInline
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                    }
                  }}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Player Controls & Scrubber */}
              <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-4 space-y-3">
                {/* Timeline slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-[#182230]">
                    <span className="font-semibold text-[#5278F5]">{formatTimecode(currentTime, true)}</span>
                    <span className="text-[#687386]">{formatTimecode(videoInfo.duration, true)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={videoInfo.duration}
                    step="0.05"
                    value={currentTime}
                    onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
                    className="w-full accent-[#5278F5] cursor-pointer"
                  />
                </div>

                {/* Stepping & Playback Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#E7EAF0]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="px-3 py-1.5 rounded-lg bg-[#5278F5] text-white text-xs font-semibold flex items-center gap-1 hover:bg-[#4165DC] transition-colors"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? 'Pause' : 'Play'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStep(-0.1)}
                      title="Back 1 frame (0.1s)"
                      className="px-2 py-1.5 rounded-lg bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0] hover:bg-[#E7EAF0] text-xs font-semibold transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStep(0.1)}
                      title="Forward 1 frame (0.1s)"
                      className="px-2 py-1.5 rounded-lg bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0] hover:bg-[#E7EAF0] text-xs font-semibold transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Capture Button */}
                  <button
                    type="button"
                    onClick={() => handleCaptureFrame()}
                    className="px-3.5 py-1.5 rounded-lg bg-[#24B47E] hover:bg-[#1f9b6c] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture Frame</span>
                  </button>
                </div>

                {/* Quick Timeline Jump Shortcuts */}
                <div className="pt-2 border-t border-[#E7EAF0] flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[#687386] mr-1">Jump to:</span>
                  {[
                    { label: 'Start (0%)', val: 0 },
                    { label: '25%', val: 0.25 },
                    { label: '50%', val: 0.5 },
                    { label: '75%', val: 0.75 },
                    { label: 'End (100%)', val: 1 },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => handleSeekShortcut(s.val)}
                      className="px-2 py-1 rounded text-[11px] font-medium bg-[#F4F6FA] text-[#182230] border border-[#E7EAF0] hover:bg-[#5278F5]/10 hover:text-[#5278F5] transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Captured Frame Preview & Export Settings (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-xs uppercase tracking-wider text-[#182230] flex items-center gap-1.5">
                    <FileImage className="w-3.5 h-3.5 text-[#5278F5]" />
                    <span>Captured Thumbnail</span>
                  </h4>
                  {capturedBlob && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#24B47E]/10 text-[#24B47E]">
                      Ready
                    </span>
                  )}
                </div>

                {/* Frame Image Container */}
                <div className="w-full bg-[#F4F6FA] rounded-lg border border-[#E7EAF0] overflow-hidden flex items-center justify-center p-2 min-h-[180px]">
                  {capturedUrl ? (
                    <img
                      src={capturedUrl}
                      alt="Captured video thumbnail"
                      className="max-h-56 max-w-full object-contain rounded shadow-xs"
                    />
                  ) : (
                    <div className="text-center text-xs text-[#687386] p-4">
                      <Camera className="w-8 h-8 opacity-30 mx-auto mb-2" />
                      <span>Click "Capture Frame" to freeze a high-res still</span>
                    </div>
                  )}
                </div>

                {capturedBlob && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#F4F6FA] rounded-lg p-2.5 border border-[#E7EAF0]">
                      <span className="text-[#687386] text-[11px] block">Dimensions</span>
                      <span className="font-semibold text-[#182230]">{capturedWidth}×{capturedHeight}</span>
                    </div>
                    <div className="bg-[#F4F6FA] rounded-lg p-2.5 border border-[#E7EAF0]">
                      <span className="text-[#687386] text-[11px] block">Image Weight</span>
                      <span className="font-semibold text-[#182230]">{formatBytes(capturedSize)}</span>
                    </div>
                  </div>
                )}

                {/* Export Format & Quality Controls */}
                <div className="space-y-3 pt-3 border-t border-[#E7EAF0]">
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                      Export Format
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormat('jpg');
                          handleCaptureFrame();
                        }}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          format === 'jpg'
                            ? 'bg-[#5278F5] text-white border-[#5278F5]'
                            : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                        }`}
                      >
                        JPG (Lightweight)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormat('png');
                          handleCaptureFrame();
                        }}
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
                        <span className="font-semibold text-[#182230]">JPG Quality</span>
                        <span className="font-mono text-[#5278F5] font-semibold">{Math.round(quality * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.6"
                        max="1.0"
                        step="0.05"
                        value={quality}
                        onChange={(e) => {
                          setQuality(parseFloat(e.target.value));
                          handleCaptureFrame();
                        }}
                        className="w-full accent-[#5278F5] cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Download Action */}
                  <button
                    onClick={handleDownload}
                    disabled={!capturedBlob}
                    className="w-full py-2.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-40"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Thumbnail ({format.toUpperCase()})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
