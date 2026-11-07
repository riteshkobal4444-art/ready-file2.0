/**
 * READYFILE Feature Flags Configuration
 * 
 * Centralized feature toggles to control tool availability.
 * When PDF_TO_WORD_ENABLED is false:
 * - PDF to Word Converter displays a "Coming Soon" badge on its card across all views.
 * - The tool card is non-clickable (normal click-to-open is disabled).
 * - Direct navigation to /tool/pdf-to-word renders a clean Coming Soon page with a lock icon and explanatory notice.
 * - Uploads, processing, and downloads are completely prevented.
 * 
 * To restore full public availability, set PDF_TO_WORD_ENABLED to true.
 */
export const PDF_TO_WORD_ENABLED = false;
