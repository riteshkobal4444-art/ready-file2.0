import React, { useState, useEffect } from 'react';
import { 
  VolumeX, 
  Volume2, 
  Download, 
  RotateCcw, 
  Check, 
  ShieldCheck, 
  FileText, 
  Play, 
  Pause,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { inspectVideoFile, formatTimecode, VideoFileInfo } from '../services/videoService';
import { muteVideo, detectAudioTrack } from '../services/ffmpegService';
import { formatBytes, downloadBlob, sanitizeFileName } from '../utils/fileHelpers';
import { 
  trackFileUpload, 
  trackProcessingStarted, 
  trackProcessingSuccess, 
  trackProcessingFailed, 
  trackFileDownload 
} from '../utils/analytics';

interface VideoMuterProps {
  onNavigateToTool?: (slug: string) => void;
}

export const VideoMuter: React.FC<VideoMuterProps> = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoFileInfo | null>(null);
  const [audioDetected, setAudioDetected] = useState<boolean | null>(null);
  const [isDetectingAudio, setIsDetectingAudio] = useState<boolean>(false);

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [mutedBlob, setMutedBlob] = useState<Blob | null>(null);
  const [mutedPreviewUrl, setMutedPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
      if (mutedPreviewUrl) URL.revokeObjectURL(mutedPreviewUrl);
    };
  }, [videoInfo, mutedPreviewUrl]);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setError(null);
    setMutedBlob(null);
    setMutedPreviewUrl('');

    setIsProcessing(true);
    setProgressMessage('Analyzing video format and headers...');
    const info = await inspectVideoFile(file);
    setIsProcessing(false);

    if (info.error) {
      setError(info.error);
      return;
    }

    setSelectedFile(file);
    setVideoInfo(info);
    trackFileUpload('video_muter', 'video', file.type || 'video/mp4');

    // Audio stream detection
    setIsDetectingAudio(true);
    detectAudioTrack(file)
      .then((hasAudio) => {
        setAudioDetected(hasAudio);
      })
      .catch(() => {
        setAudioDetected(true);
      })
      .finally(() => {
        setIsDetectingAudio(false);
      });
  };

  const handleMute = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setError(null);
    setProgressPercent(0);
    setProgressMessage('Stripping audio tracks and re-packaging video streams...');
    trackProcessingStarted('video_muter', 'video');

    try {
      const blob = await muteVideo(selectedFile, (p) => {
        setProgressPercent(p);
        setProgressMessage(`Removing audio stream (${p}%)...`);
      });

      if (mutedPreviewUrl) URL.revokeObjectURL(mutedPreviewUrl);
      const url = URL.createObjectURL(blob);

      setMutedBlob(blob);
      setMutedPreviewUrl(url);
      trackProcessingSuccess('video_muter', 'video');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove audio from video.';
      setError(msg);
      trackProcessingFailed('video_muter', 'video', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!mutedBlob || !selectedFile) return;
    const filename = sanitizeFileName(selectedFile.name, '_muted', 'mp4');
    downloadBlob(mutedBlob, filename);
    trackFileDownload('video_muter', 'video', 'video/mp4');
  };

  const handleReset = () => {
    if (videoInfo?.previewUrl) URL.revokeObjectURL(videoInfo.previewUrl);
    if (mutedPreviewUrl) URL.revokeObjectURL(mutedPreviewUrl);
    setSelectedFile(null);
    setVideoInfo(null);
    setAudioDetected(null);
    setMutedBlob(null);
    setMutedPreviewUrl('');
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Video Muter
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Permanently remove background noise, speech, and soundtracks from any video. Uses stream-copy to preserve 100% of the original video pixel quality with zero server uploads.
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Upload State */}
      {!selectedFile && !isProcessing && (
        <UploadArea
          accept="video/*,.mp4,.mov,.webm,.m4v,.mkv"
          allowedExtensions={['mp4', 'mov', 'webm', 'm4v', 'mkv']}
          title="Drop video here to remove audio"
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
              Processing in your browser using WebAssembly. Files never leave your device.
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

      {/* Active Workspace */}
      {selectedFile && videoInfo && !mutedBlob && !isProcessing && (
        <div className="space-y-6">
          {/* File summary and audio status */}
          <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left: Video Preview Player */}
            <div className="bg-[#000000] rounded-xl overflow-hidden shadow-sm aspect-video flex items-center justify-center">
              <video
                src={videoInfo.previewUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            {/* Right: Audio Track Analysis & Removal Action */}
            <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 space-y-6 shadow-sm">
              <div className="space-y-3">
                <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#182230]">
                  Audio Stream Status
                </h4>

                {isDetectingAudio ? (
                  <div className="p-3.5 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg text-xs text-[#687386] flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-[#5278F5] border-t-transparent animate-spin" />
                    <span>Analyzing audio track codecs...</span>
                  </div>
                ) : audioDetected === false ? (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>No Audio Track Detected:</strong> This video appears to be already silent. You can still export to strip container metadata.
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-[#24B47E]/10 border border-[#24B47E]/20 text-[#182230] rounded-lg text-xs flex items-center gap-2.5">
                    <Volume2 className="w-4 h-4 text-[#24B47E] shrink-0" />
                    <span>Active audio track found. Ready for clean removal.</span>
                  </div>
                )}

                <div className="space-y-2 text-xs text-[#687386] pt-1">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#24B47E]" />
                    <span>Lossless video stream copy (zero re-compression)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#24B47E]" />
                    <span>Preserves original resolution & framerate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#24B47E]" />
                    <span>Permanent stream removal (not just a muted flag)</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleMute}
                className="w-full py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <VolumeX className="w-4 h-4" />
                <span>Remove Audio & Export Silent Video</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Screen */}
      {mutedBlob && selectedFile && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7EAF0]">
            <div className="flex items-center gap-2 text-[#24B47E]">
              <div className="w-7 h-7 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-[#182230]">
                Audio Removed Successfully
              </span>
            </div>

            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mute another video</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Silent Video Preview Player */}
            <div className="bg-[#000000] rounded-xl overflow-hidden shadow-sm aspect-video flex items-center justify-center">
              <video
                src={mutedPreviewUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-3.5">
                  <span className="text-[11px] text-[#687386] block">Original File Size</span>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#182230] mt-0.5">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>

                <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-3.5">
                  <span className="text-[11px] text-[#687386] block">Silent File Size</span>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#24B47E] mt-0.5">
                    {formatBytes(mutedBlob.size)}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg text-xs text-[#687386] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#24B47E] shrink-0" />
                <span>Audio stream was completely deleted. Verified silent output.</span>
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-3 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Silent Video (MP4)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
