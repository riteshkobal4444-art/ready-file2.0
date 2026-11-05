import { RequirementPreset, RequirementCheckResult } from '../types';
import { formatBytes, getImageDimensions, getFileExtension } from '../utils/fileHelpers';
import { inspectPdfFile } from './pdfService';

export const REQUIREMENT_PRESETS: RequirementPreset[] = [
  {
    id: 'us-passport-photo',
    name: 'US Passport / Visa Photo (Digital)',
    description: 'Technical specs: JPEG, 600×600 px (1:1 square), max 240 KB',
    maxSizeBytes: 240 * 1024,
    allowedFormats: ['jpg', 'jpeg'],
    maxWidth: 1200,
    minWidth: 600,
    maxHeight: 1200,
    minHeight: 600,
    requireAspectRatio: 1.0,
    aspectRatioTolerance: 0.05,
    notes: 'Checks technical file properties. Background and facial lighting must be verified manually.',
  },
  {
    id: 'schengen-visa-photo',
    name: 'Schengen / European Visa Photo (Digital)',
    description: 'Technical specs: JPG/PNG, 35×45mm ratio (~7:9), min 413×531 px, max 2 MB',
    maxSizeBytes: 2 * 1024 * 1024,
    allowedFormats: ['jpg', 'jpeg', 'png'],
    minWidth: 400,
    minHeight: 500,
    requireAspectRatio: 35 / 45,
    aspectRatioTolerance: 0.08,
    notes: 'Checks technical file size and dimensions.',
  },
  {
    id: 'standard-portal-pdf',
    name: 'Standard Portal PDF Document (< 2 MB)',
    description: 'Technical specs: PDF format only, max 2 MB file size',
    maxSizeBytes: 2 * 1024 * 1024,
    allowedFormats: ['pdf'],
    notes: 'Ensures the document is an unencrypted readable PDF under 2 MB.',
  },
  {
    id: 'job-resume-cv',
    name: 'Job Application Resume / CV (< 5 MB)',
    description: 'Technical specs: PDF preferred, 1 to 3 pages, max 5 MB',
    maxSizeBytes: 5 * 1024 * 1024,
    allowedFormats: ['pdf'],
    minPages: 1,
    maxPages: 3,
    notes: 'Standard applicant tracking system (ATS) technical criteria.',
  },
  {
    id: 'govt-strict-500kb',
    name: 'Strict Government Portal Upload (< 500 KB)',
    description: 'Technical specs: PDF or JPEG, max 500 KB file cap',
    maxSizeBytes: 500 * 1024,
    allowedFormats: ['pdf', 'jpg', 'jpeg'],
    notes: 'Common for older tax, municipal, or exam registration portals.',
  },
];

export interface FileAnalysisDetails {
  file: File;
  name: string;
  extension: string;
  sizeBytes: number;
  mimeType: string;
  isImage: boolean;
  isPdf: boolean;
  width?: number;
  height?: number;
  pageCount?: number;
  isEncrypted?: boolean;
}

export async function analyzeFile(file: File): Promise<FileAnalysisDetails> {
  const extension = getFileExtension(file.name);
  const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(extension);
  const isPdf = file.type === 'application/pdf' || extension === 'pdf';

  const details: FileAnalysisDetails = {
    file,
    name: file.name,
    extension,
    sizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
    isImage,
    isPdf,
  };

  if (isImage) {
    try {
      const dims = await getImageDimensions(file);
      details.width = dims.width;
      details.height = dims.height;
    } catch {
      // Dimensions could not be read
    }
  } else if (isPdf) {
    try {
      const pdfInfo = await inspectPdfFile(file);
      details.pageCount = pdfInfo.pageCount;
      details.isEncrypted = pdfInfo.isEncrypted;
    } catch {
      // PDF info could not be read
    }
  }

  return details;
}

export function runRequirementChecks(
  fileDetails: FileAnalysisDetails,
  rules: RequirementPreset
): {
  overallPassed: boolean;
  checks: RequirementCheckResult[];
} {
  const checks: RequirementCheckResult[] = [];

  // 1. Format check
  const allowed = rules.allowedFormats.map((f) => f.toLowerCase().replace(/^\./, ''));
  const actualExt = fileDetails.extension.toLowerCase();
  const formatMatches = allowed.includes(actualExt);

  if (formatMatches) {
    checks.push({
      ruleName: 'File Format',
      status: 'passed',
      expected: allowed.map((f) => `.${f}`).join(', '),
      actual: `.${actualExt}`,
      message: `File format .${actualExt} is supported and accepted.`,
    });
  } else {
    checks.push({
      ruleName: 'File Format',
      status: 'failed',
      expected: allowed.map((f) => `.${f}`).join(', '),
      actual: `.${actualExt || 'unknown'}`,
      message: `File format .${actualExt || 'unknown'} does not match required formats (${allowed.map((f) => `.${f}`).join(', ')}).`,
      suggestedToolSlug: allowed.includes('pdf') ? 'image-to-pdf' : undefined,
    });
  }

  // 2. File size check
  if (rules.maxSizeBytes !== undefined && rules.maxSizeBytes > 0) {
    const sizeOk = fileDetails.sizeBytes <= rules.maxSizeBytes;
    if (sizeOk) {
      checks.push({
        ruleName: 'File Size',
        status: 'passed',
        expected: `≤ ${formatBytes(rules.maxSizeBytes)}`,
        actual: formatBytes(fileDetails.sizeBytes),
        message: `File size (${formatBytes(fileDetails.sizeBytes)}) is within the allowed limit.`,
      });
    } else {
      const overBy = fileDetails.sizeBytes - rules.maxSizeBytes;
      checks.push({
        ruleName: 'File Size',
        status: 'failed',
        expected: `≤ ${formatBytes(rules.maxSizeBytes)}`,
        actual: formatBytes(fileDetails.sizeBytes),
        message: `File is ${formatBytes(overBy)} larger than the maximum allowed limit.`,
        suggestedToolSlug: fileDetails.isImage ? 'image-compressor' : undefined,
      });
    }
  }

  // 3. Image dimensions checks
  if (fileDetails.isImage) {
    if (fileDetails.width !== undefined && fileDetails.height !== undefined) {
      // Width check
      if (rules.minWidth !== undefined || rules.maxWidth !== undefined) {
        const widthPassed =
          (rules.minWidth === undefined || fileDetails.width >= rules.minWidth) &&
          (rules.maxWidth === undefined || fileDetails.width <= rules.maxWidth);

        const expW =
          rules.minWidth && rules.maxWidth && rules.minWidth === rules.maxWidth
            ? `${rules.minWidth}px`
            : `${rules.minWidth || 0}px – ${rules.maxWidth ? rules.maxWidth + 'px' : 'any'}`;

        checks.push({
          ruleName: 'Image Width',
          status: widthPassed ? 'passed' : 'failed',
          expected: expW,
          actual: `${fileDetails.width}px`,
          message: widthPassed
            ? `Width of ${fileDetails.width}px meets requirement.`
            : `Image width (${fileDetails.width}px) is outside the required range (${expW}).`,
          suggestedToolSlug: widthPassed ? undefined : 'image-resizer',
        });
      }

      // Height check
      if (rules.minHeight !== undefined || rules.maxHeight !== undefined) {
        const heightPassed =
          (rules.minHeight === undefined || fileDetails.height >= rules.minHeight) &&
          (rules.maxHeight === undefined || fileDetails.height <= rules.maxHeight);

        const expH =
          rules.minHeight && rules.maxHeight && rules.minHeight === rules.maxHeight
            ? `${rules.minHeight}px`
            : `${rules.minHeight || 0}px – ${rules.maxHeight ? rules.maxHeight + 'px' : 'any'}`;

        checks.push({
          ruleName: 'Image Height',
          status: heightPassed ? 'passed' : 'failed',
          expected: expH,
          actual: `${fileDetails.height}px`,
          message: heightPassed
            ? `Height of ${fileDetails.height}px meets requirement.`
            : `Image height (${fileDetails.height}px) is outside the required range (${expH}).`,
          suggestedToolSlug: heightPassed ? undefined : 'image-resizer',
        });
      }

      // Aspect ratio check
      if (rules.requireAspectRatio !== undefined) {
        const actualRatio = fileDetails.width / fileDetails.height;
        const tol = rules.aspectRatioTolerance || 0.05;
        const ratioPassed = Math.abs(actualRatio - rules.requireAspectRatio) <= tol;

        const expectedRatioStr =
          rules.requireAspectRatio === 1.0
            ? '1:1 (Square)'
            : `${rules.requireAspectRatio.toFixed(2)}:1`;

        checks.push({
          ruleName: 'Aspect Ratio',
          status: ratioPassed ? 'passed' : 'failed',
          expected: expectedRatioStr,
          actual: `${(actualRatio).toFixed(2)}:1 (${fileDetails.width}×${fileDetails.height})`,
          message: ratioPassed
            ? `Aspect ratio matches the required proportions.`
            : `Image proportions do not match the expected aspect ratio (${expectedRatioStr}).`,
          suggestedToolSlug: ratioPassed ? undefined : 'image-resizer',
        });
      }
    } else {
      checks.push({
        ruleName: 'Image Dimensions',
        status: 'unverified',
        expected: 'Readable pixel dimensions',
        actual: 'Unable to decode',
        message: 'Could not extract pixel dimensions from this image file.',
      });
    }
  }

  // 4. PDF page count & encryption check
  if (fileDetails.isPdf) {
    if (fileDetails.isEncrypted) {
      checks.push({
        ruleName: 'PDF Encryption',
        status: 'failed',
        expected: 'Unencrypted / No password',
        actual: 'Password Protected',
        message: 'This PDF document is encrypted or requires a password. Automated portals will reject it.',
      });
    }

    if (rules.minPages !== undefined || rules.maxPages !== undefined) {
      if (fileDetails.pageCount !== undefined && fileDetails.pageCount > 0) {
        const pagesPassed =
          (rules.minPages === undefined || fileDetails.pageCount >= rules.minPages) &&
          (rules.maxPages === undefined || fileDetails.pageCount <= rules.maxPages);

        const expP =
          rules.minPages && rules.maxPages && rules.minPages === rules.maxPages
            ? `${rules.minPages} page${rules.minPages > 1 ? 's' : ''}`
            : `${rules.minPages || 1} to ${rules.maxPages || 'unlimited'} pages`;

        checks.push({
          ruleName: 'Page Count',
          status: pagesPassed ? 'passed' : 'failed',
          expected: expP,
          actual: `${fileDetails.pageCount} page${fileDetails.pageCount > 1 ? 's' : ''}`,
          message: pagesPassed
            ? `Page count (${fileDetails.pageCount}) is within allowable limit.`
            : `Page count (${fileDetails.pageCount}) does not match the requirement (${expP}).`,
          suggestedToolSlug: !pagesPassed && fileDetails.pageCount > (rules.maxPages || 999) ? undefined : 'pdf-merger',
        });
      } else {
        checks.push({
          ruleName: 'Page Count',
          status: 'unverified',
          expected: 'Valid PDF pages',
          actual: 'Could not count pages',
          message: 'Unable to read page count from PDF document.',
        });
      }
    }
  }

  const overallPassed = checks.length > 0 && checks.every((c) => c.status === 'passed');

  return {
    overallPassed,
    checks,
  };
}
