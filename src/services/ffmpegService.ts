import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isFfmpegLoading = false;
let loadPromise: Promise<FFmpeg> | null = null;

const CORE_VERSION = '0.12.6';
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

/**
 * Lazy loads and returns the singleton FFmpeg.wasm instance
 */
export async function getFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    if (onProgress) {
      ffmpegInstance.on('progress', ({ progress }) => {
        onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
      });
    }
    return ffmpegInstance;
  }

  if (isFfmpegLoading && loadPromise) {
    return loadPromise;
  }

  isFfmpegLoading = true;
  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
      });
    }

    try {
      const coreURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');

      await ffmpeg.load({
        coreURL,
        wasmURL,
      });

      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (err) {
      ffmpegInstance = null;
      throw new Error(
        `Failed to initialize browser video processor (FFmpeg): ${err instanceof Error ? err.message : String(err)}. Check internet connection.`
      );
    } finally {
      isFfmpegLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Removes audio tracks from a video file
 */
export async function muteVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputName = `input_${Date.now()}.${ext}`;
  const outputName = `output_${Date.now()}.mp4`;

  try {
    const fileData = await fetchFile(file);
    await ffmpeg.writeFile(inputName, fileData);

    // Try fast stream-copy first (lossless & instant)
    let exitCode = await ffmpeg.exec(['-i', inputName, '-c:v', 'copy', '-an', outputName]);

    // If stream copy fails (e.g. unsupported container or codec packet issue), re-encode with libx264
    if (exitCode !== 0) {
      await ffmpeg.deleteFile(outputName).catch(() => {});
      exitCode = await ffmpeg.exec([
        '-i',
        inputName,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '22',
        '-an',
        outputName,
      ]);
    }

    if (exitCode !== 0) {
      throw new Error(`Video processing exited with error code ${exitCode}.`);
    }

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });

    return blob;
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

/**
 * Trims a video file between start and end timestamps (in seconds)
 */
export async function trimVideo(
  file: File,
  startTimeSec: number,
  endTimeSec: number,
  mode: 'accurate' | 'fast' = 'accurate',
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputName = `input_trim_${Date.now()}.${ext}`;
  const outputName = `output_trim_${Date.now()}.mp4`;

  try {
    const fileData = await fetchFile(file);
    await ffmpeg.writeFile(inputName, fileData);

    const startStr = Math.max(0, startTimeSec).toFixed(3);
    const endStr = Math.max(startTimeSec + 0.1, endTimeSec).toFixed(3);

    let args: string[];

    if (mode === 'fast') {
      // Stream-copy: fastest, but cuts on nearest keyframe
      args = [
        '-ss',
        startStr,
        '-to',
        endStr,
        '-i',
        inputName,
        '-c',
        'copy',
        '-avoid_negative_ts',
        'make_zero',
        outputName,
      ];
    } else {
      // Frame-accurate re-encoding
      args = [
        '-ss',
        startStr,
        '-to',
        endStr,
        '-i',
        inputName,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '22',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-avoid_negative_ts',
        'make_zero',
        outputName,
      ];
    }

    let exitCode = await ffmpeg.exec(args);

    // If fast mode failed due to keyframe index issues, fallback to accurate re-encoding
    if (exitCode !== 0 && mode === 'fast') {
      await ffmpeg.deleteFile(outputName).catch(() => {});
      args = [
        '-ss',
        startStr,
        '-to',
        endStr,
        '-i',
        inputName,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-avoid_negative_ts',
        'make_zero',
        outputName,
      ];
      exitCode = await ffmpeg.exec(args);
    }

    if (exitCode !== 0) {
      throw new Error(`Video trimming exited with error code ${exitCode}.`);
    }

    const data = await ffmpeg.readFile(outputName);
    return new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

export interface CompressOptions {
  preset: 'light' | 'balanced' | 'strong';
  resolution: 'original' | '1080p' | '720p' | '480p';
  targetSizeMb?: number;
  duration?: number;
  keepAudio?: boolean;
}

/**
 * Compresses a video file using FFmpeg with preset CRF or calculated target bitrates
 */
export async function compressVideo(
  file: File,
  options: CompressOptions,
  onProgress?: (percent: number) => void
): Promise<{ blob: Blob; originalSize: number; compressedSize: number }> {
  const ffmpeg = await getFFmpeg(onProgress);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputName = `input_comp_${Date.now()}.${ext}`;
  const outputName = `output_comp_${Date.now()}.mp4`;

  try {
    const fileData = await fetchFile(file);
    await ffmpeg.writeFile(inputName, fileData);

    const args: string[] = ['-i', inputName];

    // 1. Resolution Scaling (never upscale)
    if (options.resolution === '480p') {
      args.push('-vf', 'scale=trunc(min(854\\,iw)/2)*2:trunc(min(480\\,ih)/2)*2');
    } else if (options.resolution === '720p') {
      args.push('-vf', 'scale=trunc(min(1280\\,iw)/2)*2:trunc(min(720\\,ih)/2)*2');
    } else if (options.resolution === '1080p') {
      args.push('-vf', 'scale=trunc(min(1920\\,iw)/2)*2:trunc(min(1080\\,ih)/2)*2');
    }

    // 2. Video Codec
    args.push('-c:v', 'libx264');

    // 3. Bitrate or Preset CRF
    if (options.targetSizeMb && options.duration && options.duration > 0) {
      // Calculate target video bitrate in kbps
      const targetBits = options.targetSizeMb * 8 * 1024 * 1024;
      const audioBitrate = options.keepAudio !== false ? 96 * 1024 : 0;
      const totalBitrate = targetBits / options.duration;
      const rawVideoBitrate = (totalBitrate - audioBitrate) / 1024; // in kbps
      const safeVideoBitrate = Math.max(120, Math.min(8000, Math.floor(rawVideoBitrate * 0.92)));

      args.push(
        '-b:v',
        `${safeVideoBitrate}k`,
        '-maxrate',
        `${Math.round(safeVideoBitrate * 1.4)}k`,
        '-bufsize',
        `${Math.round(safeVideoBitrate * 2)}k`,
        '-preset',
        'veryfast'
      );
    } else {
      // Standard CRF Presets
      if (options.preset === 'light') {
        args.push('-crf', '23', '-preset', 'veryfast');
      } else if (options.preset === 'strong') {
        args.push('-crf', '33', '-preset', 'veryfast');
      } else {
        // Balanced
        args.push('-crf', '28', '-preset', 'veryfast');
      }
    }

    // 4. Audio settings
    if (options.keepAudio === false) {
      args.push('-an');
    } else {
      args.push('-c:a', 'aac', '-b:a', '96k');
    }

    // 5. Faststart for web streaming playback
    args.push('-movflags', '+faststart', outputName);

    const exitCode = await ffmpeg.exec(args);

    if (exitCode !== 0) {
      throw new Error(`Video compression exited with error code ${exitCode}.`);
    }

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });

    return {
      blob,
      originalSize: file.size,
      compressedSize: blob.size,
    };
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

/**
 * Checks whether the video contains an audio stream by analyzing FFmpeg probe output
 */
export async function detectAudioTrack(file: File): Promise<boolean> {
  try {
    const ffmpeg = await getFFmpeg();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const tempName = `probe_${Date.now()}.${ext}`;

    // Read first 512KB for quick header probe
    const slice = file.slice(0, Math.min(file.size, 512 * 1024));
    const sliceData = await fetchFile(slice);
    await ffmpeg.writeFile(tempName, sliceData);

    let hasAudioLog = false;
    const logHandler = ({ message }: { message: string }) => {
      if (message.toLowerCase().includes('audio:')) {
        hasAudioLog = true;
      }
    };

    ffmpeg.on('log', logHandler);
    try {
      await ffmpeg.exec(['-i', tempName]);
    } catch {
      // -i without output always exits with non-zero
    } finally {
      ffmpeg.off('log', logHandler);
      await ffmpeg.deleteFile(tempName).catch(() => {});
    }

    return hasAudioLog;
  } catch {
    // Default fallback to true
    return true;
  }
}
