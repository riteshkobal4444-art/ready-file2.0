export type ToolCategory = 'image' | 'pdf' | 'doc';

export interface ToolItem {
  id: string;
  slug: string;
  name: string;
  category: ToolCategory;
  categoryName: string;
  description: string;
  tagline: string;
  status: 'active' | 'coming_soon';
  icon: string;
  badge?: string;
  features?: string[];
  plannedRelease?: string;
}

export interface GuideItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  readTime: string;
  summary: string;
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
  checklist: string[];
  relatedToolSlugs: string[];
}

export interface RequirementPreset {
  id: string;
  name: string;
  description: string;
  maxSizeBytes?: number; // bytes
  allowedFormats: string[]; // extensions or mimes e.g. ['pdf', 'jpg', 'png']
  maxPages?: number;
  minPages?: number;
  maxWidth?: number;
  minWidth?: number;
  maxHeight?: number;
  minHeight?: number;
  requireAspectRatio?: number; // e.g., 1 (square), 35/45 (passport)
  aspectRatioTolerance?: number;
  notes?: string;
}

export interface RequirementCheckResult {
  ruleName: string;
  status: 'passed' | 'failed' | 'unverified';
  expected: string;
  actual: string;
  message: string;
  suggestedToolSlug?: string;
}
