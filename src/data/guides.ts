import { GuideItem } from '../types';

export const GUIDES: GuideItem[] = [
  {
    id: 'passport-photo-prep',
    slug: 'passport-size-photo-guide',
    title: 'How to Prepare a Compliant Passport or Visa Photo',
    category: 'Photos & IDs',
    readTime: '3 min read',
    summary: 'Standard government portals reject over 40% of DIY passport photos due to bad lighting, incorrect dimensions, or head proportion errors. Follow these strict guidelines.',
    steps: [
      {
        title: 'Step 1: Check required dimensions and aspect ratio',
        description: 'US and Indian passport/visa applications typically require 2x2 inches (51x51 mm) or a square 600x600 px image. European Schengen visas require 35x45 mm (roughly 7:9 ratio). Verify your target portal requirements first.',
        tip: 'Use our File Requirement Checker to verify exact pixel dimensions before uploading.'
      },
      {
        title: 'Step 2: Set up lighting and background',
        description: 'Stand 1 to 2 feet away from a plain white or light off-white wall. Avoid shadows behind your head and under your chin. Natural daylight from a front-facing window is ideal.',
        tip: 'Ensure both ears and the full oval of your face are evenly lit without harsh flash reflections.'
      },
      {
        title: 'Step 3: Frame head height (50% to 69% of image height)',
        description: 'From the bottom of your chin to the top of your hair must measure between 1 inch and 1 3/8 inches (50% to 69% of the total frame height). Look directly at the camera with a neutral expression.',
      },
      {
        title: 'Step 4: Export to JPEG without excessive compression',
        description: 'Most portals specify a maximum file size between 200 KB and 1 MB. Use our Image Compressor to reduce file weight while maintaining 90%+ image fidelity.',
        tip: 'Never stretch or artificially squish the image to fit dimensions—always crop proportionally.'
      }
    ],
    checklist: [
      'Plain white or light off-white background with zero shadows',
      'Neutral facial expression with both eyes open and mouth closed',
      'Direct front-facing posture, head not tilted',
      'No spectacles/glasses with glare, hats, or head coverings (unless religious/medical)',
      'Dimensions verified against portal specs',
      'File size under the maximum portal upload limit'
    ],
    relatedToolSlugs: ['image-resizer', 'image-compressor', 'file-checker']
  },
  {
    id: 'document-scanning',
    slug: 'scan-documents-properly',
    title: 'How to Scan Physical Documents for Clean Digital Submission',
    category: 'Scanning & Uploads',
    readTime: '4 min read',
    summary: 'Avoid blurry mobile photos, dark corners, and tilted pages when submitting transcripts, bank statements, contracts, or tax returns.',
    steps: [
      {
        title: 'Step 1: Flatten the paper on a high-contrast surface',
        description: 'Smooth out any folds or dog-eared corners. Place white documents on a dark desk or table so edge detection algorithms can locate corners cleanly.',
      },
      {
        title: 'Step 2: Maintain overhead alignment (no keystoning)',
        description: 'Hold your camera directly parallel to the paper. Do not shoot at an angle, as perspective distortion makes fine text illegible to OCR systems.',
        tip: 'Turn on gridlines in your smartphone camera app to align parallel margins.'
      },
      {
        title: 'Step 3: Capture at 300 DPI or clear uniform lighting',
        description: 'For physical flatbed scanners, 300 DPI grayscale or color provides the best balance of crisp legibility and manageable file size. For smartphone scans, avoid casting your phone shadow across the text.',
      },
      {
        title: 'Step 4: Convert scans to a single combined PDF',
        description: 'Government, university, and employment portals almost universally prefer a single multi-page PDF rather than a dozen scattered JPEG files.',
        tip: 'Use Readyfile Image to PDF to arrange multiple page scans in sequential order.'
      }
    ],
    checklist: [
      'Text is sharp and legible down to the smallest footer',
      'All four document borders are cleanly cropped with no background clutter',
      'Orientation is right-side up for every page',
      'Multiple pages are compiled into a single PDF in sequential order',
      'File size complies with portal limits (often < 5 MB)'
    ],
    relatedToolSlugs: ['image-to-pdf', 'pdf-merger', 'file-checker']
  },
  {
    id: 'reduce-image-size',
    slug: 'reduce-image-file-size-without-quality-loss',
    title: 'How to Reduce Image File Size Without Visible Quality Loss',
    category: 'Optimization',
    readTime: '3 min read',
    summary: 'Master the mechanics of web compression so your uploads beat portal file caps (e.g., 200 KB or 500 KB) while maintaining razor-sharp text and photos.',
    steps: [
      {
        title: 'Step 1: Choose the correct format for your content',
        description: 'Photographs with gradients and natural colors are best compressed as JPEG or WebP. Scanned documents, line art, diagrams, and signatures with transparent backgrounds should remain PNG.',
        tip: 'Converting transparent PNG signatures to JPEG causes an ugly black or white matte background box.'
      },
      {
        title: 'Step 2: Downscale oversized camera resolutions first',
        description: 'Modern smartphone cameras capture images at 4000x3000 px (12 to 48 megapixels), resulting in 5 to 15 MB files. Most portals only need 1200 to 1920 px maximum dimension.',
        tip: 'Resizing dimensions first can drop file size by 70% before any compression is applied!'
      },
      {
        title: 'Step 3: Apply lossy compression between 75% and 85%',
        description: 'Human vision cannot distinguish between a 100% quality JPEG and an 80% quality JPEG on standard screens, yet the 80% version is often 4x smaller.',
      },
      {
        title: 'Step 4: Verify with the Readyfile Image Compressor',
        description: 'Upload your file into Readyfile Image Compressor to see the real-time byte count and percentage reduction processed entirely in your browser.',
      }
    ],
    checklist: [
      'Dimensions scaled down if source is a 12MP+ camera photo',
      'Output format selected to match document type (PNG for transparency, JPEG for photos)',
      'File size verified under portal ceiling (e.g. < 200 KB)',
      'Text within the image remains crisp when zoomed to 100%'
    ],
    relatedToolSlugs: ['image-compressor', 'image-resizer', 'file-checker']
  },
  {
    id: 'pdf-submission-prep',
    slug: 'prepare-pdf-for-online-submission',
    title: 'How to Prepare a PDF Document for Official Online Submission',
    category: 'PDF Mastery',
    readTime: '4 min read',
    summary: 'Avoid the dreaded "Upload failed: Document does not meet technical specifications" error on government, university, and employment portals.',
    steps: [
      {
        title: 'Step 1: Confirm maximum file size allowance',
        description: 'Most portals cap attachments at 2 MB, 5 MB, or 10 MB. Check the portal specifications before attempting an upload.',
      },
      {
        title: 'Step 2: Ensure uniform page dimensions',
        description: 'Mixing US Letter (8.5x11 in) and A4 (8.27x11.69 in) in the same file can cause automated printing systems or verification bots to flag the document. Keep all pages consistent.',
      },
      {
        title: 'Step 3: Remove unnecessary high-resolution scans',
        description: 'Embedded images scanned at 1200 DPI bloat PDF documents to 40 MB+. Re-scan or downsample raster imagery to 150-300 DPI for digital submissions.',
      },
      {
        title: 'Step 4: Verify that password protection is removed',
        description: 'Automated portals cannot review encrypted or password-protected PDFs. Make sure your bank statements or pay stubs are unlocked before submitting.',
        tip: 'If your file asks for a password to open, automated applicant tracking systems will immediately reject it.'
      }
    ],
    checklist: [
      'Document opens cleanly without password prompt',
      'Pages are arranged in sequential, logical order',
      'All pages share standard dimensions (e.g., standard A4 or Letter)',
      'Total file size is within portal limits',
      'File name uses safe alphanumeric characters without spaces (e.g. John_Doe_Resume.pdf)'
    ],
    relatedToolSlugs: ['pdf-merger', 'image-to-pdf', 'file-checker']
  },
  {
    id: 'merge-pdfs-cleanly',
    slug: 'merge-multiple-pdf-documents-cleanly',
    title: 'How to Merge Multiple PDF Documents in the Right Order',
    category: 'PDF Mastery',
    readTime: '3 min read',
    summary: 'When an employer or visa officer asks for a single consolidated PDF dossier, learn how to stitch your cover letter, resume, and credentials flawlessly.',
    steps: [
      {
        title: 'Step 1: Collect and rename all source files in sequence',
        description: 'Prefix your source files with sequential numbers (e.g., "01_Cover_Letter.pdf", "02_Resume.pdf", "03_Transcripts.pdf") to keep your workspace organized.',
      },
      {
        title: 'Step 2: Check page count and orientation for each file',
        description: 'Ensure each individual document is oriented vertically. Having one landscape spreadsheet inside a portrait dossier is acceptable if formatted intentionally.',
      },
      {
        title: 'Step 3: Upload to Readyfile PDF Merger',
        description: 'Select all PDFs at once. Readyfile inspects every file in your browser, displays individual page counts, and allows drag-and-drop reordering.',
      },
      {
        title: 'Step 4: Review final combined page count',
        description: 'Before downloading, confirm that the merged page count matches the sum of the input files.',
        tip: 'Your files are merged securely directly in your browser without transmitting sensitive financial or legal data to external servers.'
      }
    ],
    checklist: [
      'Correct document reading order verified',
      'No blank filler pages at the end of sections',
      'Combined file size stays under recipient email/portal limit',
      'All signatures and dates remain visible'
    ],
    relatedToolSlugs: ['pdf-merger', 'image-to-pdf', 'file-checker']
  },
  {
    id: 'understanding-dimensions-formats',
    slug: 'understanding-image-dimensions-dpi-formats',
    title: 'Understanding Pixels, DPI, and Formats for Online Forms',
    category: 'Fundamentals',
    readTime: '4 min read',
    summary: 'Confused by "600x600 pixels", "300 DPI", "JPEG only", and "Aspect Ratio 1:1"? Here is the non-technical plain language guide.',
    steps: [
      {
        title: 'What does "Pixel Dimensions" mean?',
        description: 'Pixel dimensions (e.g. 1920x1080) describe the physical grid of colored dots that make up your image on a screen. 1920 pixels wide by 1080 pixels high.',
      },
      {
        title: 'What is Aspect Ratio?',
        description: 'Aspect ratio is the proportional relationship between width and height. A 1:1 ratio is a perfect square (e.g., 600x600 or 1200x1200). A 4:3 or 16:9 ratio is rectangular. Locking aspect ratio prevents stretched or squished faces.',
      },
      {
        title: 'What is DPI (Dots Per Inch)?',
        description: 'DPI only matters when printing onto physical paper. On a screen or web upload portal, only the pixel count matters. A 600x600 px image at 72 DPI has the exact same digital pixels as a 600x600 px image at 300 DPI.',
      },
      {
        title: 'Which format should you upload?',
        description: '• JPEG / JPG: Standard for photographs, certificates with color backgrounds. Good compression.\n• PNG: Ideal for line art, text documents, and transparent signatures.\n• WebP: Modern lightweight web format, but older government portals may not accept it.\n• PDF: Gold standard for multi-page documents and official applications.',
      }
    ],
    checklist: [
      'Image width & height match portal requirements',
      'Aspect ratio maintained during resize to prevent distortion',
      'Format matches portal whitelist (e.g. strictly JPG or PDF)',
      'Color space is standard sRGB (default for all mobile/web cameras)'
    ],
    relatedToolSlugs: ['image-resizer', 'image-compressor', 'file-checker']
  },
  {
    id: 'submission-checklist',
    slug: 'document-submission-checklist',
    title: 'The Ultimate Document Submission Pre-Flight Checklist',
    category: 'Best Practices',
    readTime: '3 min read',
    summary: 'A 60-second audit routine to run through before hitting "Final Submit" on any university, job, or government portal.',
    steps: [
      {
        title: 'Item 1: File Naming Hygiene',
        description: 'Never upload "IMG_9281.JPG" or "Untitled document (1).pdf". Use clear, professional naming: "LastName_FirstName_PassportCopy.pdf". Avoid spaces, slashes, or special characters.',
      },
      {
        title: 'Item 2: Size & Page Limit Verification',
        description: 'Ensure the file is strictly below the maximum upload cap (often 2 MB or 5 MB). Check that multi-page forms include all pages, even instruction or acknowledgement pages if mandated.',
      },
      {
        title: 'Item 3: Legibility and Zoom Test',
        description: 'Open the final file on your screen and zoom in to 150%. Can you read serial numbers, signatures, and dates clearly? If it is blurry to you, it will fail automated OCR review.',
      },
      {
        title: 'Item 4: Run Readyfile File Requirement Checker',
        description: 'Drop your file into our File Requirement Checker to inspect the real underlying byte size, true MIME type, and dimension properties in 1 second.',
      }
    ],
    checklist: [
      'Meaningful, professional filename without special symbols',
      'No passwords, security locks, or encryption on PDF files',
      'File size complies with portal requirements',
      'Page sequence verified',
      'All signatures and notary stamps are completely visible',
      'Technical check passed in Readyfile Requirement Checker'
    ],
    relatedToolSlugs: ['file-checker', 'image-compressor', 'pdf-merger']
  }
];

export const getGuideBySlug = (slug: string): GuideItem | undefined => {
  return GUIDES.find((g) => g.slug === slug || g.id === slug);
};
