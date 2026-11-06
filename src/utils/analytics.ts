/**
 * Centralized Analytics Utility for READYFILE
 * Dispatches production-ready events to:
 * 1. Google Analytics 4 (via official gtag.js)
 * 2. Vercel Web Analytics (via @vercel/analytics track API)
 *
 * Privacy & Security Rules:
 * - NEVER sends file contents, filenames, personal data, or raw stack traces.
 * - Only safe parameters: tool_name, tool_category, sanitized file_type, safe failure_category.
 * - Asynchronous and non-blocking: errors are silently caught so analytics never breaks user workflow.
 */

import { track } from '@vercel/analytics';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Sanitizes MIME types and extensions into generic safe formats (e.g. 'image/jpeg', 'pdf', 'video/mp4')
 */
export function sanitizeFileType(rawTypeOrExt?: string | null): string {
  if (!rawTypeOrExt) return 'unknown';

  const lower = rawTypeOrExt.toLowerCase().trim();

  // Common image types
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'image/jpeg';
  if (lower.includes('png')) return 'image/png';
  if (lower.includes('webp')) return 'image/webp';
  if (lower.includes('bmp')) return 'image/bmp';
  if (lower.includes('gif')) return 'image/gif';
  if (lower.includes('svg')) return 'image/svg+xml';

  // PDF
  if (lower.includes('pdf')) return 'application/pdf';

  // Video types
  if (lower.includes('mp4')) return 'video/mp4';
  if (lower.includes('webm')) return 'video/webm';
  if (lower.includes('mov') || lower.includes('quicktime')) return 'video/quicktime';
  if (lower.includes('mkv')) return 'video/x-matroska';
  if (lower.includes('avi')) return 'video/x-msvideo';

  // Fallback to broad category if known
  if (lower.startsWith('image/')) return 'image';
  if (lower.startsWith('video/')) return 'video';
  if (lower.startsWith('audio/')) return 'audio';

  return 'generic';
}

/**
 * Normalizes error messages into high-level, safe failure categories without exposing user details or stack traces
 */
export function sanitizeFailureCategory(error?: unknown): string {
  if (!error) return 'unknown_error';

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('password') || message.includes('encrypted')) return 'password_protected';
  if (message.includes('type') || message.includes('unsupported') || message.includes('format')) return 'invalid_file_type';
  if (message.includes('size') || message.includes('large') || message.includes('limit') || message.includes('bytes')) return 'size_limit_exceeded';
  if (message.includes('corrupt') || message.includes('decode') || message.includes('unreadable')) return 'corrupt_file';
  if (message.includes('dimension') || message.includes('resolution') || message.includes('width') || message.includes('height')) return 'dimension_error';
  if (message.includes('abort') || message.includes('cancel')) return 'user_cancelled';
  if (message.includes('memory') || message.includes('oom') || message.includes('exhausted')) return 'out_of_memory';
  if (message.includes('timeout')) return 'processing_timeout';

  return 'processing_error';
}

/**
 * Dispatches event safely to Google Analytics 4 and Vercel Analytics
 */
function emitEvent(eventName: string, params: Record<string, string | number | boolean>) {
  try {
    // 1. Google Analytics 4 dispatch
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }

    // 2. Vercel Web Analytics custom event dispatch
    track(eventName, params);

    // Development diagnostic logging
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[Analytics] ${eventName}:`, params);
    }
  } catch (err) {
    // Analytics failures must never interrupt user experience
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[Analytics Error]', err);
    }
  }
}

/**
 * 1. tool_open: Fired when a user navigates to and opens a specific tool
 */
export function trackToolOpen(toolName: string, toolCategory: string) {
  emitEvent('tool_open', {
    tool_name: toolName,
    tool_category: toolCategory,
  });
}

/**
 * 2. file_upload: Fired only when a user actually selects or drops valid file(s)
 */
export function trackFileUpload(toolName: string, toolCategory: string, rawFileType?: string | null) {
  emitEvent('file_upload', {
    tool_name: toolName,
    tool_category: toolCategory,
    file_type: sanitizeFileType(rawFileType),
  });
}

/**
 * 3. processing_started: Fired when genuine processing operation begins
 */
export function trackProcessingStarted(toolName: string, toolCategory: string, rawFileType?: string | null) {
  emitEvent('processing_started', {
    tool_name: toolName,
    tool_category: toolCategory,
    file_type: sanitizeFileType(rawFileType),
  });
}

/**
 * 4. processing_success: Fired only after the tool successfully finishes processing
 */
export function trackProcessingSuccess(toolName: string, toolCategory: string, rawFileType?: string | null) {
  emitEvent('processing_success', {
    tool_name: toolName,
    tool_category: toolCategory,
    file_type: sanitizeFileType(rawFileType),
  });
}

/**
 * 5. processing_failed: Fired only when a processing operation genuinely errors out
 */
export function trackProcessingFailed(
  toolName: string,
  toolCategory: string,
  error?: unknown,
  rawFileType?: string | null
) {
  emitEvent('processing_failed', {
    tool_name: toolName,
    tool_category: toolCategory,
    failure_category: sanitizeFailureCategory(error),
    file_type: sanitizeFileType(rawFileType),
  });
}

/**
 * 6. file_download: Fired when the user triggers the download of the produced output file
 */
export function trackFileDownload(toolName: string, toolCategory: string, rawFileType?: string | null) {
  emitEvent('file_download', {
    tool_name: toolName,
    tool_category: toolCategory,
    file_type: sanitizeFileType(rawFileType),
  });
}
