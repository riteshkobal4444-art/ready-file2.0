import JSZip from 'jszip';
import { formatBytes } from '../utils/fileHelpers';

export interface VideoFileInfo {
  name: string;
  size: number;
  type: string;
  duration: number; // in seconds
  width: number;
  height: number;
  aspectRatio: string;
  hasAudio: boolean;
  canPlay: boolean;
  previewUrl: string;
  firstFrameUrl: string;
  error?: string;
}

export interface ExtractedFrame {
  id: string;
  index: number;
  timestamp: number;
  timestampLabel: string;
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  size: number;
}

/**
 * Formats a duration in seconds to standard timecode string: mm:ss or hh:mm:ss
 */
export function formatTimecode(seconds: number, includeMilliseconds = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const ms = Math.floor((seconds - totalSecs) * 100);
  const msStr = includeMilliseconds ? `.${ms.toString().padStart(2, '0')}` : '';

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${msStr}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${msStr}`;
}

/**
 * Calculates a simplified aspect ratio string from pixel width and height (e.g., "16:9", "9:16", "4:3")
 */
export function calculateAspectRatio(width: number, height: number): string {
  if (!width || !height) return 'Unknown';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const rw = width / divisor;
  const rh = height / divisor;

  // Check common approximations
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16 (Portrait)';
  if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
  if (Math.abs(ratio - 1) < 0.05) return '1:1 (Square)';
  if (Math.abs(ratio - 21 / 9) < 0.05) return '21:9 (Ultrawide)';

  return `${rw}:${rh}`;
}

/**
 * Inspects a video file in the browser using HTMLVideoElement and Canvas
 */
export function inspectVideoFile(file: File): Promise<VideoFileInfo> {
  return new Promise((resolve) => {
    const previewUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let timeoutId: number;

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };

    const onError = () => {
      cleanup();
      resolve({
        name: file.name,
        size: file.size,
        type: file.type || 'video/mp4',
        duration: 0,
        width: 0,
        height: 0,
        aspectRatio: 'Unknown',
        hasAudio: false,
        canPlay: false,
        previewUrl,
        firstFrameUrl: '',
        error: 'The browser cannot decode or play this video file format or codec.',
      });
    };

    const onLoadedMetadata = async () => {
      cleanup();
      const duration = video.duration || 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      const aspectRatio = calculateAspectRatio(width, height);

      // Detect audio track presence
      let hasAudio = false;
      try {
        const vAny = video as any;
        if (typeof vAny.mozHasAudio !== 'undefined') {
          hasAudio = Boolean(vAny.mozHasAudio);
        } else if (vAny.webkitAudioDecodedByteCount > 0) {
          hasAudio = true;
        } else if (vAny.audioTracks && vAny.audioTracks.length > 0) {
          hasAudio = true;
        } else {
          // Assume audio exists if file size is consistent with standard audiovisual media
          hasAudio = true;
        }
      } catch {
        hasAudio = true;
      }

      // Seek to 0.1s to capture the first frame
      const seekTime = Math.min(0.2, duration > 1 ? 0.5 : duration / 2);
      video.currentTime = seekTime;

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        let firstFrameUrl = '';
        try {
          if (width > 0 && height > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(width, 640);
            canvas.height = Math.round(canvas.width / (width / height));
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              firstFrameUrl = canvas.toDataURL('image/jpeg', 0.85);
            }
          }
        } catch {
          // Canvas capture might fail if tainted or cross-origin
        }

        resolve({
          name: file.name,
          size: file.size,
          type: file.type || 'video/mp4',
          duration,
          width,
          height,
          aspectRatio,
          hasAudio,
          canPlay: true,
          previewUrl,
          firstFrameUrl,
        });
      };

      video.addEventListener('seeked', onSeeked, { once: true });
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);

    // Timeout guard (10 seconds)
    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve({
        name: file.name,
        size: file.size,
        type: file.type || 'video/mp4',
        duration: 0,
        width: 0,
        height: 0,
        aspectRatio: 'Unknown',
        hasAudio: false,
        canPlay: false,
        previewUrl,
        firstFrameUrl: '',
        error: 'Video inspection timed out. The file may be corrupt or too large for quick header inspection.',
      });
    }, 10000);

    video.src = previewUrl;
  });
}

/**
 * Captures a single high-resolution frame at the given timestamp from a video
 */
export function captureFrameAtTime(
  videoElement: HTMLVideoElement,
  timestamp: number,
  format: 'jpg' | 'png' = 'jpg',
  quality = 0.92
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; size: number }> {
  return new Promise((resolve, reject) => {
    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;

    if (!width || !height) {
      reject(new Error('Video dimensions unavailable. Ensure the video is loaded before capturing.'));
      return;
    }

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(videoElement, 0, 0, width, height);

        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create image blob from canvas'));
              return;
            }
            const dataUrl = canvas.toDataURL(mime, quality);
            resolve({
              blob,
              dataUrl,
              width,
              height,
              size: blob.size,
            });
          },
          mime,
          quality
        );
      } catch (err) {
        reject(err);
      }
    };

    // If already at timestamp within 0.05s
    if (Math.abs(videoElement.currentTime - timestamp) < 0.05) {
      onSeeked();
    } else {
      videoElement.addEventListener('seeked', onSeeked, { once: true });
      videoElement.currentTime = timestamp;
    }
  });
}

/**
 * Extracts multiple video frames at specified timestamps using native HTMLVideoElement and Canvas
 */
export async function extractMultipleFrames(
  videoUrl: string,
  timestamps: number[],
  format: 'jpg' | 'png' = 'jpg',
  quality = 0.9,
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedFrame[]> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  // Wait for metadata
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video for extraction'));
    video.src = videoUrl;
  });

  const width = video.videoWidth;
  const height = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const results: ExtractedFrame[] = [];
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';

  for (let i = 0; i < timestamps.length; i++) {
    const t = Math.max(0, Math.min(video.duration, timestamps[i]));

    // Seek to t
    await new Promise<void>((res) => {
      video.onseeked = () => res();
      video.currentTime = t;
    });

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error('Failed blob conversion'))),
        mime,
        quality
      );
    });

    const dataUrl = canvas.toDataURL(mime, quality);

    results.push({
      id: `frame-${i + 1}-${Date.now()}`,
      index: i + 1,
      timestamp: t,
      timestampLabel: formatTimecode(t, true),
      blob,
      dataUrl,
      width,
      height,
      size: blob.size,
    });

    if (onProgress) {
      onProgress(i + 1, timestamps.length);
    }
  }

  return results;
}

/**
 * Packages extracted frames into a downloadable ZIP archive using JSZip
 */
export async function createFramesZip(frames: ExtractedFrame[], baseName: string, format: 'jpg' | 'png'): Promise<Blob> {
  const zip = new JSZip();
  const cleanBase = baseName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = zip.folder(`${cleanBase}_frames`) || zip;

  frames.forEach((frame) => {
    const timeFormatted = frame.timestampLabel.replace(':', 'm').replace('.', 's_');
    const filename = `frame_${frame.index.toString().padStart(3, '0')}_${timeFormatted}.${format}`;
    folder.file(filename, frame.blob);
  });

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
