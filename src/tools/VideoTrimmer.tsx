import React, { useState, useRef, useEffect } from 'react';
import { 
  Scissors, 
  Play, 
  Pause, 
  Download, 
  RotateCcw, 
  Check, 
  Sliders, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectVideoFile, formatTimecode, VideoFileInfo } from '../services/videoService';
import { trimVideo } from '../services/ffmpegService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';

interface VideoTrimmerProps {
  onNavigateToTool?: (slug: string) => void;
}

export const VideoTrimmer: React.FC<VideoTrimmerProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoFileInfo | null>(null);

  // Trimming Range
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(10);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mode, setMode] = useState<'accurate' | 'fast'>('accurate');

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);
  const [trimmedPreviewUrl, setTrimmedPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const trimmedVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
      if (trimmedPreviewUrl) URL.revokeObjectURL(trimmedPreviewUrl);
    };
  }, [videoInfo, trimmedPreviewUrl]);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setTrimmedBlob(null);
    setTrimmedPreviewUrl('');

    setIsProcessing(true);
    setProgressMessage('Analyzing video duration and codecs...');
    const info = await inspectVideoFile(file);
    setIsProcessing(false);

    if (info.error) {
      setError(info.error);
      return;
    }

    setSelectedFile(file);
    setVideoInfo(info);
    setStartTime(0);
    setEndTime(Math.min(info.duration, info.duration > 15 ? 15 : info.duration));
    setCurrentTime(0);
  };

  const handleStartTimeChange = (val: number) => {
    const clamped = Math.max(0, Math.min(endTime - 0.2, val));
    setStartTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleEndTimeChange = (val: number) => {
    const maxDur = videoInfo?.duration || 10;
    const clamped = Math.min(maxDur, Math.max(startTime + 0.2, val));
    setEndTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handlePreviewSelection = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = startTime;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    // Stop when reaching endTime during preview
    if (cur >= endTime && isPlaying) {
      videoRef.current.pause();
      videoRef.current.currentTime = startTime;
      setIsPlaying(false);
    }
  };

  const handleTrim = async () => {
    if (!selectedFile || !videoInfo) return;

    if (endTime <= startTime) {
      setError('End time must be strictly greater than start time.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgressPercent(0);
    setProgressMessage(
      mode === 'accurate'
        ? 'Re-encoding exact frame range with libx264...'
        : 'Fast stream-copying keyframe sequence...'
    );

    try {
      const blob = await trimVideo(selectedFile, startTime, endTime, mode, (p) => {
        setProgressPercent(p);
        setProgressMessage(`Trimming clip (${p}%)...`);
      });

      if (trimmedPreviewUrl) URL.revokeObjectURL(trimmedPreviewUrl);
      const url = URL.createObjectURL(blob);

      setTrimmedBlob(blob);
      setTrimmedPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trim video file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!trimmedBlob || !selectedFile) return;
    const startStr = formatTimecode(startTime).replace(':', 'm') + 's';
    const endStr = formatTimecode(endTime).replace(':', 'm') + 's';
    const filename = sanitizeFileName(selectedFile.name, `_trimmed_${startStr}_to_${endStr}`, 'mp4');
    downloadBlob(trimmedBlob, filename);
  };

  const handleReset = () => {
    if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
    if (trimmedPreviewUrl) URL.revokeObjectURL(trimmedPreviewUrl);
    setSelectedFile(null);
    setVideoInfo(null);
    setTrimmedBlob(null);
    setTrimmedPreviewUrl('');
    setError(null);
    setIsPlaying(false);
  };

  const clipDuration = Math.max(0, endTime - startTime);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Video Trimmer
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Trim, cut, and shorten video clips with millisecond accuracy. Choose between frame-accurate re-encoding or instant keyframe stream-copying entirely inside your browser.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="video/*,.mp4,.mov,.webm,.m4v,.mkv"
          allowedExtensions={['mp4', 'mov', 'webm', 'm4v', 'mkv']}
          title="Drop video here to trim"
          subtitle="Supports MP4, WebM, MOV, and common video files"
          onFilesSelected={handleFiles}
        />
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full border-3 border-[#5278F5]/20 border-t-[#5278F5] animate-spin mx-auto" />
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
              {progressMessage}
            </h3>
            <p className="text-xs text-[#687386] mt-1">
              Processing in your browser using FFmpeg WebAssembly.
            </p>
          </div>
          {progressPercent > 0 && (
            <div className="w-full max-w-md mx-auto bg-[#E7EAF0] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#5278F5] h-full transition-all duration-200 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Workspace */}
      {selectedFile && videoInfo && !trimmedBlob && !isProcessing && (
        <div className="space-y-6">
          {/* File summary bar */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                {videoInfo.name}
              </h3>
              <span className="text-xs text-[#687386]">
                {formatBytes(videoInfo.size)} • {videoInfo.width}×{videoInfo.height} ({videoInfo.aspectRatio}) • Full Duration: {formatTimecode(videoInfo.duration)}
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
            {/* Left: Video Preview Player (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-[#000000] rounded-xl overflow-hidden shadow-sm aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={videoInfo.previewUrl}
                  playsInline
                  onTimeUpdate={onTimeUpdate}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Player Timeline Bar */}
              <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#5278F5] font-semibold">Current: {formatTimecode(currentTime, true)}</span>
                  <span className="text-[#687386]">Total: {formatTimecode(videoInfo.duration, true)}</span>
                </div>

                {/* Scrubber slider */}
                <input
                  type="range"
                  min="0"
                  max={videoInfo.duration}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    setCurrentTime(t);
                    if (videoRef.current) videoRef.current.currentTime = t;
                  }}
                  className="w-full accent-[#5278F5] cursor-pointer"
                />

                <div className="flex items-center justify-between pt-2 border-t border-[#E7EAF0]">
                  <button
                    type="button"
                    onClick={handlePreviewSelection}
                    className="px-3.5 py-1.5 rounded-lg bg-[#5278F5] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#4165DC] transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Play Selected Range ({formatTimecode(clipDuration)})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!videoRef.current) return;
                      videoRef.current.pause();
                      setIsPlaying(false);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] text-xs font-medium text-[#182230] hover:bg-[#F4F6FA]"
                  >
                    Pause
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Trimming Range & Encoding Controls (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 space-y-5 shadow-sm">
                <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-xs uppercase tracking-wider text-[#182230] flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-[#5278F5]" />
                  <span>Trim Range Settings</span>
                </h4>

                {/* Start & End Time Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">
                      Start Time (s)
                    </label>
                    <div className="space-y-1">
                      <input
                        type="number"
                        min="0"
                        max={endTime - 0.1}
                        step="0.1"
                        value={Number(startTime.toFixed(2))}
                        onChange={(e) => handleStartTimeChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E7EAF0] focus:outline-none focus:border-[#5278F5] bg-[#FFFFFF] text-[#182230]"
                      />
                      <span className="text-[11px] text-[#687386] font-mono block">
                        {formatTimecode(startTime, true)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">
                      End Time (s)
                    </label>
                    <div className="space-y-1">
                      <input
                        type="number"
                        min={startTime + 0.1}
                        max={videoInfo.duration}
                        step="0.1"
                        value={Number(endTime.toFixed(2))}
                        onChange={(e) => handleEndTimeChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#E7EAF0] focus:outline-none focus:border-[#5278F5] bg-[#FFFFFF] text-[#182230]"
                      />
                      <span className="text-[11px] text-[#687386] font-mono block">
                        {formatTimecode(endTime, true)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Range Sliders */}
                <div className="space-y-2 pt-2 border-t border-[#E7EAF0]">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-[#687386]">Start Cut Position:</span>
                    <input
                      type="range"
                      min="0"
                      max={videoInfo.duration}
                      step="0.1"
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(parseFloat(e.target.value))}
                      className="w-full accent-[#5278F5] cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-[#687386]">End Cut Position:</span>
                    <input
                      type="range"
                      min="0"
                      max={videoInfo.duration}
                      step="0.1"
                      value={endTime}
                      onChange={(e) => handleEndTimeChange(parseFloat(e.target.value))}
                      className="w-full accent-[#24B47E] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Selected Clip Summary Box */}
                <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-3 text-xs flex items-center justify-between">
                  <span className="text-[#687386]">Output Clip Duration:</span>
                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#5278F5]">
                    {formatTimecode(clipDuration, true)}
                  </span>
                </div>

                {/* Trimming Mode */}
                <div className="space-y-1.5 pt-2 border-t border-[#E7EAF0]">
                  <label className="block text-xs font-semibold text-[#182230]">
                    Processing Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('accurate')}
                      className={`p-2.5 rounded-lg text-left border text-xs transition-colors ${
                        mode === 'accurate'
                          ? 'border-[#5278F5] bg-[#5278F5]/5 text-[#5278F5] font-semibold'
                          : 'border-[#E7EAF0] text-[#182230]'
                      }`}
                    >
                      <span className="block font-bold">Frame-Accurate</span>
                      <span className="text-[10px] text-[#687386] font-normal">Re-encodes exact frames</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('fast')}
                      className={`p-2.5 rounded-lg text-left border text-xs transition-colors ${
                        mode === 'fast'
                          ? 'border-[#5278F5] bg-[#5278F5]/5 text-[#5278F5] font-semibold'
                          : 'border-[#E7EAF0] text-[#182230]'
                      }`}
                    >
                      <span className="block font-bold">Fast Stream-Copy</span>
                      <span className="text-[10px] text-[#687386] font-normal">Nearest keyframe cut</span>
                    </button>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={handleTrim}
                  className="w-full py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Scissors className="w-4 h-4" />
                  <span>Trim Video Clip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Screen */}
      {trimmedBlob && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Video Trimmed Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Trim another video</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Trimmed Video Preview */}
            <div className="bg-[#000000] rounded-xl overflow-hidden shadow-sm aspect-video flex items-center justify-center">
              <video
                ref={trimmedVideoRef}
                src={trimmedPreviewUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-3.5">
                  <span className="text-[11px] text-[#687386] block">Clip Duration</span>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#5278F5] mt-0.5">
                    {formatTimecode(clipDuration, true)}
                  </p>
                </div>

                <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-3.5">
                  <span className="text-[11px] text-[#687386] block">Output Size</span>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#182230] mt-0.5">
                    {formatBytes(trimmedBlob.size)}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg text-xs text-[#687386] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#24B47E] shrink-0" />
                <span>
                  Trimmed {formatTimecode(startTime)} to {formatTimecode(endTime)} ({mode === 'accurate' ? 'frame-accurate' : 'stream-copy'}).
                </span>
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Trimmed Video (MP4)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
