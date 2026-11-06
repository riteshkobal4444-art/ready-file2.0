import React, { useState, useEffect } from 'react';
import { 
  Film, 
  Download, 
  RotateCcw, 
  Check, 
  Sliders, 
  Clock, 
  ArrowRight,
  TrendingDown,
  AlertCircle,
  ShieldCheck,
  Zap,
  Volume2,
  VolumeX
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectVideoFile, formatTimecode, VideoFileInfo } from '../services/videoService';
import { compressVideo, CompressOptions } from '../services/ffmpegService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';
import { 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';

interface VideoCompressorProps {
  onNavigateToTool?: (slug: string) => void;
}

export const VideoCompressor: React.FC<VideoCompressorProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoFileInfo | null>(null);

  // Settings
  const [preset, setPreset] = useState<'light' | 'balanced' | 'strong'>('balanced');
  const [resolution, setResolution] = useState<'original' | '1080p' | '720p' | '480p'>('original');
  const [useTargetSize, setUseTargetSize] = useState<boolean>(false);
  const [targetSizeMb, setTargetSizeMb] = useState<number>(15);
  const [keepAudio, setKeepAudio] = useState<boolean>(true);

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [compressedResult, setCompressedResult] = useState<{
    blob: Blob;
    originalSize: number;
    compressedSize: number;
    previewUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
      if (compressedResult?.previewUrl) URL.revokeObjectURL(compressedResult.previewUrl);
    };
  }, [videoInfo, compressedResult]);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setCompressedResult(null);

    setIsProcessing(true);
    setProgressMessage('Reading video streams and dimensions...');
    const info = await inspectVideoFile(file);
    setIsProcessing(false);

    if (info.error) {
      setError(info.error);
      return;
    }

    setSelectedFile(file);
    setVideoInfo(info);
    trackFileUpload('video_compressor', 'video', file.type || 'video/mp4');

    // Initial sensible target size suggestion (e.g. 50% of original or 15MB)
    const initialTarget = Math.max(5, Math.min(50, Math.round((file.size / (1024 * 1024)) * 0.5)));
    setTargetSizeMb(initialTarget);
  };

  const handleCompress = async () => {
    if (!selectedFile || !videoInfo) return;

    setIsProcessing(true);
    setError(null);
    setProgressPercent(0);
    setProgressMessage('Compacting video bitrate with libx264...');
    trackProcessingStarted('video_compressor', 'video');

    const options: CompressOptions = {
      preset,
      resolution,
      targetSizeMb: useTargetSize ? targetSizeMb : undefined,
      duration: videoInfo.duration,
      keepAudio,
    };

    try {
      const result = await compressVideo(selectedFile, options, (p) => {
        setProgressPercent(p);
        setProgressMessage(`Compressing video frames (${p}%)...`);
      });

      if (compressedResult?.previewUrl) {
        URL.revokeObjectURL(compressedResult.previewUrl);
      }

      const previewUrl = URL.createObjectURL(result.blob);

      setCompressedResult({
        blob: result.blob,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        previewUrl,
      });
      trackProcessingSuccess('video_compressor', 'video');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to compress video.';
      setError(msg);
      trackProcessingFailed('video_compressor', 'video', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!compressedResult || !selectedFile) return;
    const filename = sanitizeFileName(selectedFile.name, '_compressed', 'mp4');
    downloadBlob(compressedResult.blob, filename);
    trackFileDownload('video_compressor', 'video', 'video/mp4');
  };

  const handleReset = () => {
    if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
    if (compressedResult?.previewUrl) URL.revokeObjectURL(compressedResult.previewUrl);
    setSelectedFile(null);
    setVideoInfo(null);
    setCompressedResult(null);
    setError(null);
  };

  const reductionPercent = compressedResult
    ? Math.round(
        ((compressedResult.originalSize - compressedResult.compressedSize) /
          compressedResult.originalSize) *
          100
      )
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Video Compressor
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Shrink heavy video files to meet email, messaging, and portal upload size limits. Downsample bitrates and rescale dimensions without cloud servers or privacy compromises.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="video/*,.mp4,.mov,.webm,.m4v,.mkv"
          allowedExtensions={['mp4', 'mov', 'webm', 'm4v', 'mkv']}
          title="Drop video here to compress"
          subtitle="Supports MP4, MOV, WebM, and standard video files"
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
              Transcoding video in your browser using WebAssembly. Please keep this tab open.
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

      {/* Configuration & Workspace */}
      {selectedFile && videoInfo && !compressedResult && !isProcessing && (
        <div className="space-y-6">
          {/* File summary bar */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
                {videoInfo.name}
              </h3>
              <span className="text-xs text-[#687386]">
                Original: {formatBytes(videoInfo.size)} • {videoInfo.width}×{videoInfo.height} ({videoInfo.aspectRatio}) • Duration: {formatTimecode(videoInfo.duration)}
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-[#687386] hover:text-[#E05252] self-start sm:self-auto transition-colors"
            >
              Choose different video
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left: Video Preview Player */}
            <div className="space-y-3">
              <div className="bg-[#000000] rounded-xl overflow-hidden shadow-sm aspect-video flex items-center justify-center">
                <video
                  src={videoInfo.previewUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[11px] text-[#687386] block text-center">
                Original video preview ({videoInfo.width}×{videoInfo.height})
              </span>
            </div>

            {/* Right: Compression Settings */}
            <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 space-y-5 shadow-sm">
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-xs uppercase tracking-wider text-[#182230] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#5278F5]" />
                <span>Compression Settings</span>
              </h4>

              {/* Presets */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#182230]">
                  Compression Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'light', label: 'Light', desc: 'High Quality' },
                    { id: 'balanced', label: 'Balanced', desc: 'Recommended' },
                    { id: 'strong', label: 'Strong', desc: 'Smallest Size' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPreset(p.id as any);
                        setUseTargetSize(false);
                      }}
                      className={`p-2.5 rounded-lg text-center border text-xs transition-colors ${
                        !useTargetSize && preset === p.id
                          ? 'border-[#5278F5] bg-[#5278F5]/5 text-[#5278F5] font-semibold'
                          : 'border-[#E7EAF0] text-[#182230] hover:bg-[#F4F6FA]'
                      }`}
                    >
                      <span className="block font-bold">{p.label}</span>
                      <span className="text-[10px] text-[#687386] block">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target File Size (Optional) */}
              <div className="space-y-2 pt-2 border-t border-[#E7EAF0]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#182230]">
                    Target File Size Ceiling
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseTargetSize(!useTargetSize)}
                    className="text-[11px] font-semibold text-[#5278F5] hover:underline"
                  >
                    {useTargetSize ? 'Use Presets Instead' : 'Specify Target MB'}
                  </button>
                </div>

                {useTargetSize ? (
                  <div className="space-y-2 p-3 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#687386]">Desired approximate size:</span>
                      <span className="font-mono font-bold text-[#5278F5]">{targetSizeMb} MB</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max={Math.max(20, Math.round(selectedFile.size / (1024 * 1024)))}
                      step="1"
                      value={targetSizeMb}
                      onChange={(e) => setTargetSizeMb(parseInt(e.target.value, 10))}
                      className="w-full accent-[#5278F5] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#687386]">
                      <span>2 MB (Messaging)</span>
                      <span>15 MB (Email)</span>
                      <span>25 MB (Discord/Forms)</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#687386]">
                    Preset CRF compression automatically optimizes bitrates to maximize perceptual quality.
                  </p>
                )}
              </div>

              {/* Resolution Rescaling */}
              <div className="space-y-1.5 pt-2 border-t border-[#E7EAF0]">
                <label className="block text-xs font-semibold text-[#182230]">
                  Output Resolution
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'original', label: 'Original' },
                    { id: '1080p', label: '1080p' },
                    { id: '720p', label: '720p' },
                    { id: '480p', label: '480p' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setResolution(r.id as any)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        resolution === r.id
                          ? 'bg-[#5278F5] text-white border-[#5278F5]'
                          : 'bg-[#F4F6FA] text-[#182230] border-[#E7EAF0]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-[#E7EAF0]">
                <span className="text-xs text-[#182230] font-medium">Keep Audio Track</span>
                <button
                  type="button"
                  onClick={() => setKeepAudio(!keepAudio)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                    keepAudio
                      ? 'bg-[#24B47E]/10 text-[#24B47E] border-[#24B47E]/30'
                      : 'bg-[#F4F6FA] text-[#687386] border-[#E7EAF0]'
                  }`}
                >
                  {keepAudio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{keepAudio ? 'Audio Included' : 'Audio Removed'}</span>
                </button>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleCompress}
                className="w-full py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Film className="w-4 h-4" />
                <span>Compress Video Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Screen */}
      {compressedResult && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Video Compressed Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Compress another video</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Compressed Video Player */}
            <div className="bg-[#000000] rounded-xl overflow-hidden shadow-sm aspect-video flex items-center justify-center">
              <video
                src={compressedResult.previewUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            {/* Metrics & Download */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-3">
                  <span className="text-[10px] text-[#687386] uppercase block font-semibold">Original</span>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230] mt-0.5">
                    {formatBytes(compressedResult.originalSize)}
                  </p>
                </div>

                <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-3">
                  <span className="text-[10px] text-[#687386] uppercase block font-semibold">Compressed</span>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#24B47E] mt-0.5">
                    {formatBytes(compressedResult.compressedSize)}
                  </p>
                </div>

                <div className="bg-[#24B47E]/10 border border-[#24B47E]/20 rounded-lg p-3">
                  <span className="text-[10px] text-[#24B47E] uppercase block font-bold">Reduction</span>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#24B47E] mt-0.5">
                    {reductionPercent > 0 ? `-${reductionPercent}%` : '0%'}
                  </p>
                </div>
              </div>

              {reductionPercent <= 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Notice: This video was already heavily compressed. Try choosing a Stronger preset or lower resolution (720p/480p) for greater savings.
                  </span>
                </div>
              )}

              <div className="p-3 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg text-xs text-[#687386] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#24B47E] shrink-0" />
                <span>Compatible MP4/H.264 format with web-optimized stream metadata.</span>
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Compressed Video</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
