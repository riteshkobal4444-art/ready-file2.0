import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  notes?: string;
}

export interface Checklist {
  id: string;
  title: string;
  category: string;
  isCustom: boolean;
  createdAt: string;
  items: ChecklistItem[];
}

export const PREDEFINED_CHECKLIST_TEMPLATES: Omit<Checklist, 'id' | 'createdAt'>[] = [
  {
    title: 'Passport Application Checklist',
    category: 'Government & ID',
    isCustom: false,
    items: [
      { id: 'p1', label: 'Completed Official Passport Application Form (Printed & Signed)', completed: false },
      { id: 'p2', label: 'Two (2) Identical Compliant Passport Photos (e.g. 2x2 in or 35x45 mm)', completed: false },
      { id: 'p3', label: 'Proof of Citizenship (Birth Certificate, Naturalization Certificate, or Consular Report)', completed: false },
      { id: 'p4', label: 'Government Photo ID (Driver License, State ID, Military ID)', completed: false },
      { id: 'p5', label: 'Photocopy of Identification Document (Front & Back on standard letter/A4 paper)', completed: false },
      { id: 'p6', label: 'Proof of Name Change (Marriage Certificate or Court Order, if applicable)', completed: false },
      { id: 'p7', label: 'Passport Application & Execution Fee Payment (Check / Money Order / Card receipt)', completed: false },
    ],
  },
  {
    title: 'Job Application & Onboarding Checklist',
    category: 'Career & Employment',
    isCustom: false,
    items: [
      { id: 'j1', label: 'Tailored Resume / Curriculum Vitae (PDF format, under 2 MB)', completed: false },
      { id: 'j2', label: 'Cover Letter addressed to Hiring Manager or Department', completed: false },
      { id: 'j3', label: 'Official Educational Degree Certificate or Academic Transcripts', completed: false },
      { id: 'j4', label: 'Government Identification / Work Authorization / Passport Copy', completed: false },
      { id: 'j5', label: 'Two or Three Professional Reference Contacts with email & phone', completed: false },
      { id: 'j6', label: 'Work Portfolio / Code Samples / Writing Samples (PDF or link)', completed: false },
      { id: 'j7', label: 'Direct Deposit Voided Check or Bank Routing Details (for onboarding)', completed: false },
    ],
  },
  {
    title: 'College & University Admission Checklist',
    category: 'Education & Admissions',
    isCustom: false,
    items: [
      { id: 'c1', label: 'Completed University Application Form (Common App or Institution Portal)', completed: false },
      { id: 'c2', label: 'Official High School or Prior College Transcripts (Signed & Sealed)', completed: false },
      { id: 'c3', label: 'Standardized Test Score Reports (SAT, ACT, GRE, GMAT, or IELTS/TOEFL)', completed: false },
      { id: 'c4', label: 'Personal Statement / Statement of Purpose (PDF)', completed: false },
      { id: 'c5', label: 'Academic Letters of Recommendation (2 to 3 from professors/counselors)', completed: false },
      { id: 'c6', label: 'Financial Guarantee Statement or Bank Balance Certificate', completed: false },
      { id: 'c7', label: 'Copy of Passport Identification Page (for International Students)', completed: false },
    ],
  },
  {
    title: 'Scholarship Application Checklist',
    category: 'Education & Grants',
    isCustom: false,
    items: [
      { id: 's1', label: 'Scholarship Application Form completed in full', completed: false },
      { id: 's2', label: 'Scholarship Essay or Research Motivation Letter', completed: false },
      { id: 's3', label: 'Cumulative GPA Academic Transcript Record', completed: false },
      { id: 's4', label: 'Proof of Financial Need or Household Income Tax Return', completed: false },
      { id: 's5', label: 'Letter of Recommendation from academic advisor or community mentor', completed: false },
      { id: 's6', label: 'Extracurricular Activities & Leadership Resume', completed: false },
    ],
  },
  {
    title: 'Visa Application Checklist (Tourist / Business)',
    category: 'Travel & Immigration',
    isCustom: false,
    items: [
      { id: 'v1', label: 'Valid Passport with at least 6 months validity & 2 blank pages', completed: false },
      { id: 'v2', label: 'Completed & Signed Visa Application Form', completed: false },
      { id: 'v3', label: 'Recent Passport-size Photos meeting embassy specifications', completed: false },
      { id: 'v4', label: 'Round-trip Flight Itinerary or Flight Reservation Confirmation', completed: false },
      { id: 'v5', label: 'Hotel Booking or Official Host Invitation Letter with proof of residence', completed: false },
      { id: 'v6', label: 'Last 3 to 6 Months Bank Account Statements showing sufficient funds', completed: false },
      { id: 'v7', label: 'Travel Medical Insurance Policy (e.g. €30,000 coverage for Schengen)', completed: false },
      { id: 'v8', label: 'Employment Verification Letter / No Objection Certificate (NOC)', completed: false },
    ],
  },
  {
    title: 'Government Document Application Checklist',
    category: 'Public Services',
    isCustom: false,
    items: [
      { id: 'g1', label: 'Completed Official Agency Application Form', completed: false },
      { id: 'g2', label: 'Primary Proof of Identity (Passport, National ID, or Driver License)', completed: false },
      { id: 'g3', label: 'Proof of Residential Address (Utility Bill, Rental Agreement < 90 days)', completed: false },
      { id: 'g4', label: 'Birth Certificate or Legal Proof of Age', completed: false },
      { id: 'g5', label: 'Tax Identification Number / Social Security / PAN / National Number', completed: false },
      { id: 'g6', label: 'Self-attested photocopies of all submitted credentials', completed: false },
      { id: 'g7', label: 'Administrative Processing Fee Receipt', completed: false },
    ],
  },
  {
    title: 'General Document Submission Checklist',
    category: 'General Preparation',
    isCustom: false,
    items: [
      { id: 'd1', label: 'Cover Letter or Submission Summary Sheet', completed: false },
      { id: 'd2', label: 'All required forms signed and dated in permanent ink', completed: false },
      { id: 'd3', label: 'Document files named cleanly (e.g. Lastname_Firstname_Document.pdf)', completed: false },
      { id: 'd4', label: 'All files verified under portal size limit (using File Requirement Checker)', completed: false },
      { id: 'd5', label: 'PDF orientation verified right-side up for every page', completed: false },
      { id: 'd6', label: 'High-contrast scans with zero corner shadows or blurry text', completed: false },
      { id: 'd7', label: 'Backup archive copy saved to personal local storage', completed: false },
    ],
  },
];

const LOCAL_STORAGE_KEY = 'readyfile_checklists_v1';

/**
 * Loads all checklists from localStorage or initializes with predefined templates
 */
export function loadSavedChecklists(): Checklist[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  // Initialize with predefined templates
  const initial: Checklist[] = PREDEFINED_CHECKLIST_TEMPLATES.map((tmpl, index) => ({
    ...tmpl,
    id: `template-${index + 1}`,
    createdAt: new Date().toISOString(),
  }));

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // ignore
  }

  return initial;
}

/**
 * Saves checklists to localStorage
 */
export function saveChecklists(checklists: Checklist[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(checklists));
  } catch {
    // localstorage full or blocked
  }
}

/**
 * Generates an elegant, printer-friendly PDF of the checklist
 */
export async function exportChecklistToPdf(checklist: Checklist): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const margin = 45;
  let y = height - 50;

  // Header Bar
  page.drawText('READYFILE', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.32, 0.47, 0.96), // #5278F5
  });

  page.drawText('DOCUMENT PREPARATION CHECKLIST', {
    x: width - margin - 220,
    y,
    size: 9,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.52),
  });

  y -= 20;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.9, 0.92, 0.94),
  });

  y -= 30;

  // Checklist Title
  page.drawText(checklist.title, {
    x: margin,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.09, 0.13, 0.19),
  });

  y -= 18;
  const completedCount = checklist.items.filter((i) => i.completed).length;
  const progressText = `Status: ${completedCount} of ${checklist.items.length} items verified (${Math.round(
    (completedCount / Math.max(1, checklist.items.length)) * 100
  )}% complete) • Generated: ${new Date().toLocaleDateString()}`;

  page.drawText(progressText, {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.45, 0.52),
  });

  y -= 25;

  // Table header
  page.drawRectangle({
    x: margin,
    y: y - 5,
    width: width - margin * 2,
    height: 22,
    color: rgb(0.96, 0.96, 0.98),
  });

  page.drawText('STATUS', {
    x: margin + 10,
    y,
    size: 8,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.52),
  });

  page.drawText('REQUIRED DOCUMENT ITEM', {
    x: margin + 65,
    y,
    size: 8,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.52),
  });

  y -= 25;

  // Items
  for (let i = 0; i < checklist.items.length; i++) {
    const item = checklist.items[i];

    // Checkbox box
    page.drawRectangle({
      x: margin + 12,
      y: y - 2,
      width: 14,
      height: 14,
      borderColor: item.completed ? rgb(0.14, 0.7, 0.49) : rgb(0.7, 0.73, 0.8),
      borderWidth: 1.5,
      color: item.completed ? rgb(0.14, 0.7, 0.49) : rgb(1, 1, 1),
    });

    if (item.completed) {
      page.drawText('X', {
        x: margin + 15.5,
        y: y + 1.5,
        size: 9,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
    }

    // Item text
    const cleanLabel = item.label.length > 80 ? item.label.substring(0, 78) + '...' : item.label;
    page.drawText(cleanLabel, {
      x: margin + 65,
      y,
      size: 10,
      font: item.completed ? font : boldFont,
      color: item.completed ? rgb(0.4, 0.45, 0.52) : rgb(0.09, 0.13, 0.19),
    });

    y -= 12;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.93, 0.94, 0.96),
    });

    y -= 18;
  }

  // Footer Disclaimer
  y = 40;
  page.drawLine({
    start: { x: margin, y: y + 15 },
    end: { x: width - margin, y: y + 15 },
    thickness: 0.5,
    color: rgb(0.9, 0.92, 0.94),
  });

  page.drawText(
    'Notice: Requirements vary by institution, country, and authority. Verify all requirements with the relevant official agency.',
    {
      x: margin,
      y,
      size: 7.5,
      font,
      color: rgb(0.45, 0.5, 0.57),
    }
  );

  const bytes = await pdfDoc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}
