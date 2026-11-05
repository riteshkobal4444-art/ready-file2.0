# READYFILE — Every document. Ready to submit. (Version 1.2)

A clean, free, privacy-conscious online document preparation platform built with React, TypeScript, Tailwind CSS, and `pdf-lib`.

---

## 🌟 Product Overview

READYFILE empowers users to prepare, format, and verify documents for official portals (visas, government services, job applications, university submissions) without complicated software or privacy compromises.

### Core Principles
1. **100% In-Browser Privacy**: All file transformations (compression, resizing, cropping, format conversion, passport framing, digital signatures, PDF generation, PDF merging, and PDF splitting) happen locally inside the client's browser using HTML5 Canvas and `pdf-lib`. No files are uploaded to external servers or cloud storage.
2. **No Registration**: No logins, subscriptions, paywalls, or accounts in Version 1.2.
3. **Real Utility**: Zero fake progress bars or mock downloads. Every active tool produces real, verified output files.

---

## 🛠️ The 15 Planned Tools

### 10 Active Version 1.2 Tools

**Image Tools (6 active):**
- **Image Compressor**: Canvas-driven compression for JPEG, PNG, and WebP with transparency protection and quality sliders.
- **Image Resizer**: Dimension adjustments with aspect ratio locking and portal presets.
- **Image to PDF**: Multi-image compiler with reordering, A4 / US Letter formats, and portrait/landscape orientation.
- **Image Cropper**: Interactive draggable and resizable crop box, rule-of-thirds grid, aspect ratios (Free, 1:1, 4:3, 16:9, etc.), custom ratios, 90° rotation, and multi-format export.
- **Image Format Converter**: Batch conversion between JPG, PNG, WebP, and BMP (with built-in Windows 24-bit BMP encoder), individual download, and ZIP archive download.
- **Passport Photo Maker**: Standard dimensions (35×45mm, 2×2in, 30×40mm, 50×70mm, custom mm/cm/in/px), 300 & 600 DPI, facial framing guide oval, background selection, and iterative size cap compression.
- **Signature Maker**: Three creation methods:
  - **Draw**: Smooth bezier curves with stylus/touch/mouse, pen thickness, ink colors, and undo.
  - **Type**: Elegant handwriting script fonts (`Dancing Script`, `Caveat`, `Great Vibes`, `Sacramento`, `Marck Script`).
  - **Upload**: Paper photo thresholding that extracts dark ink and makes paper background transparent.

**PDF Tools (2 active):**
- **PDF Merger**: Combines multiple PDF files, reads live page counts, allows reordering, and validates against password protection.
- **PDF Splitter**: Extract selected pages into a new PDF, split by custom page ranges (e.g., `1-3, 4-6`), split every page individually, or divide into equal groups of N pages, with ZIP download support.

**Document Preparation (1 active):**
- **File Requirement Checker**: Pre-flight inspection tool verifying byte limits, MIME types, image dimensions, and PDF page counts against standard visa, job, and government criteria.

---

### 5 Remaining Coming Soon Tools (Previewed with specification)
- **PDF Tools**: PDF Compressor, PDF to Images, Rotate PDF, Reorder PDF Pages
- **Document Preparation**: Document Checklist Builder

---

## 📚 7 Document Preparation Guides

1. **How to Prepare a Compliant Passport or Visa Photo**
2. **How to Scan Physical Documents for Clean Digital Submission**
3. **How to Reduce Image File Size Without Visible Quality Loss**
4. **How to Prepare a PDF Document for Official Online Submission**
5. **How to Merge Multiple PDF Documents in the Right Order**
6. **Understanding Pixels, DPI, and Formats for Online Forms**
7. **The Ultimate Document Submission Pre-Flight Checklist**

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/readyfile.git
cd readyfile

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be accessible at `http://localhost:3000`.

### Building for Production
```bash
npm run build
```

---

## 🌐 Vercel Deployment

1. Push your repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. Framework Preset: **Vite**.
4. Root Directory: `./`.
5. Build Command: `npm run build`.
6. Output Directory: `dist`.
7. `vercel.json` is configured with client-side SPA rewrites for seamless direct URL navigation.

---

## 🔒 Privacy & Security Architecture
- Images and PDFs are loaded as browser `Blob` and `ArrayBuffer` instances.
- Processing occurs via `HTMLCanvasElement` and `PDFDocument` in browser memory.
- Object URLs are safely revoked on reset and component disposal.
- Zero analytics tracking, telemetry, or remote document transmission.
