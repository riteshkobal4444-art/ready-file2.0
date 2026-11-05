import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  FileCheck, 
  RotateCcw, 
  ArrowRight, 
  Sliders, 
  ShieldAlert, 
  FileText, 
  Sparkles,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { UploadArea } from '../components/UploadArea';
import { ProcessingState } from '../components/ProcessingState';
import { ErrorMessage } from '../components/ErrorMessage';
import { 
  REQUIREMENT_PRESETS, 
  analyzeFile, 
  runRequirementChecks, 
  FileAnalysisDetails 
} from '../services/requirementService';
import { RequirementPreset, RequirementCheckResult } from '../types';
import { formatBytes } from '../utils/fileHelpers';

interface RequirementCheckerProps {
  onNavigateToTool?: (toolSlug: string) => void;
}

export const RequirementChecker: React.FC<RequirementCheckerProps> = ({ onNavigateToTool }) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('us-passport-photo');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Custom preset fields
  const [customMaxMB, setCustomMaxMB] = useState<string>('2');
  const [customFormats, setCustomFormats] = useState<string>('pdf, jpg, png');
  const [customMaxWidth, setCustomMaxWidth] = useState<string>('');
  const [customMaxHeight, setCustomMaxHeight] = useState<string>('');
  const [customMaxPages, setCustomMaxPages] = useState<string>('');

  const [analyzedFiles, setAnalyzedFiles] = useState<
    { details: FileAnalysisDetails; result: { overallPassed: boolean; checks: RequirementCheckResult[] } }[]
  >([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getActivePreset = (): RequirementPreset => {
    if (isCustomMode) {
      const maxSizeBytes = parseFloat(customMaxMB) ? parseFloat(customMaxMB) * 1024 * 1024 : undefined;
      const allowed = customFormats
        .split(',')
        .map((f) => f.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean);

      return {
        id: 'custom',
        name: 'Custom Portal Requirements',
        description: 'Defined by your custom requirements input',
        maxSizeBytes,
        allowedFormats: allowed.length ? allowed : ['pdf', 'jpg', 'png'],
        maxWidth: parseInt(customMaxWidth, 10) || undefined,
        maxHeight: parseInt(customMaxHeight, 10) || undefined,
        maxPages: parseInt(customMaxPages, 10) || undefined,
        notes: 'Checking against your custom specification.',
      };
    }

    return REQUIREMENT_PRESETS.find((p) => p.id === selectedPresetId) || REQUIREMENT_PRESETS[0];
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setIsAnalyzing(true);

    try {
      const currentPreset = getActivePreset();
      const results = [];

      for (const file of files) {
        const details = await analyzeFile(file);
        const checkResult = runRequirementChecks(details, currentPreset);
        results.push({ details, result: checkResult });
      }

      setAnalyzedFiles(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error evaluating file specifications.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reevaluateCurrentFiles = async (preset: RequirementPreset) => {
    if (analyzedFiles.length === 0) return;
    setIsAnalyzing(true);
    const updated = analyzedFiles.map((item) => {
      const checkResult = runRequirementChecks(item.details, preset);
      return { ...item, result: checkResult };
    });
    setAnalyzedFiles(updated);
    setIsAnalyzing(false);
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    setIsCustomMode(false);
    const preset = REQUIREMENT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      reevaluateCurrentFiles(preset);
    }
  };

  const handleReset = () => {
    setAnalyzedFiles([]);
    setError(null);
  };

  const currentPreset = getActivePreset();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5278F5] mb-1">
          <FileCheck className="w-4 h-4" />
          <span>Pre-Flight Technical Verification</span>
        </div>
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          File Requirement Checker
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Inspect whether your files satisfy portal upload criteria before submission. Verifies file byte sizes, true file extensions, pixel dimensions, and PDF page counts.
        </p>

        {/* Disclaimer Notice */}
        <div className="mt-4 p-3 rounded-lg bg-[#F4F6FA] border border-[#E7EAF0] text-xs text-[#687386] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[#5278F5] shrink-0 mt-0.5" />
          <span>
            <strong>Technical Verification Only:</strong> This tool checks mechanical file attributes (bytes, pixels, format). It does not certify official legal validity, document authenticity, or guarantee institutional acceptance.
          </span>
        </div>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Specification Selector */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7EAF0] mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#5278F5]" />
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230]">
              Target Portal Criteria
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(false);
                reevaluateCurrentFiles(REQUIREMENT_PRESETS.find((p) => p.id === selectedPresetId) || REQUIREMENT_PRESETS[0]);
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                !isCustomMode
                  ? 'bg-[#5278F5] text-white border-[#5278F5]'
                  : 'bg-[#F4F6FA] text-[#687386] border-[#E7EAF0]'
              }`}
            >
              Standard Presets
            </button>
            <button
              type="button"
              onClick={() => setIsCustomMode(true)}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                isCustomMode
                  ? 'bg-[#5278F5] text-white border-[#5278F5]'
                  : 'bg-[#F4F6FA] text-[#687386] border-[#E7EAF0]'
              }`}
            >
              Custom Rules
            </button>
          </div>
        </div>

        {!isCustomMode ? (
          <div>
            <label className="block text-xs font-semibold text-[#182230] mb-2">
              Select Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {REQUIREMENT_PRESETS.map((p) => {
                const isSelected = selectedPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetSelect(p.id)}
                    className={`text-left p-3 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'bg-[#5278F5]/5 border-[#5278F5] shadow-xs'
                        : 'bg-[#F4F6FA] border-[#E7EAF0] hover:border-[#C4C5D6]'
                    }`}
                  >
                    <div className="font-semibold text-[#182230] mb-0.5 flex items-center justify-between">
                      <span>{p.name}</span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-[#5278F5]" />}
                    </div>
                    <p className="text-[11px] text-[#687386] line-clamp-2">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="e.g. 2"
                  value={customMaxMB}
                  onChange={(e) => setCustomMaxMB(e.target.value)}
                  className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">
                  Allowed Formats (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="pdf, jpg, png"
                  value={customFormats}
                  onChange={(e) => setCustomFormats(e.target.value)}
                  className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">
                  Max PDF Pages (optional)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 3"
                  value={customMaxPages}
                  onChange={(e) => setCustomMaxPages(e.target.value)}
                  className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">
                  Max Image Width (px, optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1200"
                  value={customMaxWidth}
                  onChange={(e) => setCustomMaxWidth(e.target.value)}
                  className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">
                  Max Image Height (px, optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1200"
                  value={customMaxHeight}
                  onChange={(e) => setCustomMaxHeight(e.target.value)}
                  className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#E7EAF0] rounded-lg text-xs text-[#182230] focus:outline-none focus:border-[#5278F5]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => reevaluateCurrentFiles(getActivePreset())}
              className="px-4 py-1.5 rounded-lg bg-[#5278F5] text-white text-xs font-medium"
            >
              Apply Custom Criteria
            </button>
          </div>
        )}
      </div>

      {/* Upload State */}
      {analyzedFiles.length === 0 && !isAnalyzing && (
        <UploadArea
          multiple
          accept="*/*"
          title="Drop any document or image to inspect"
          subtitle={`Checks against: ${currentPreset.name}`}
          onFilesSelected={handleFiles}
        />
      )}

      {/* Analyzing Progress */}
      {isAnalyzing && <ProcessingState message="Extracting file headers, pixel bounds, and page counts..." />}

      {/* Results View */}
      {analyzedFiles.length > 0 && !isAnalyzing && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-lg text-[#182230]">
              Inspection Results ({analyzedFiles.length} {analyzedFiles.length === 1 ? 'File' : 'Files'})
            </h3>
            <button
              onClick={handleReset}
              className="text-xs font-medium text-[#687386] hover:text-[#5278F5] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Check another file</span>
            </button>
          </div>

          {analyzedFiles.map(({ details, result }, idx) => {
            const overallPassed = result.overallPassed;

            return (
              <div
                key={idx}
                className={`bg-[#FFFFFF] border rounded-xl overflow-hidden shadow-sm transition-all ${
                  overallPassed ? 'border-[#24B47E]/40' : 'border-[#E05252]/40'
                }`}
              >
                {/* File Header Banner */}
                <div
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
                    overallPassed
                      ? 'bg-[#24B47E]/5 border-[#24B47E]/20'
                      : 'bg-[#E05252]/5 border-[#E05252]/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        overallPassed
                          ? 'bg-[#24B47E]/20 text-[#24B47E]'
                          : 'bg-[#E05252]/20 text-[#E05252]'
                      }`}
                    >
                      {overallPassed ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <XCircle className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#182230] truncate max-w-sm">
                        {details.name}
                      </h4>
                      <p className="text-xs text-[#687386] mt-0.5">
                        {formatBytes(details.sizeBytes)} • {details.extension.toUpperCase()}
                        {details.width ? ` • ${details.width}×${details.height} px` : ''}
                        {details.pageCount ? ` • ${details.pageCount} pages` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Overall badge */}
                  <div>
                    {overallPassed ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#24B47E] text-white shadow-xs">
                        All Technical Checks Passed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#E05252] text-white shadow-xs">
                        Action Required (Requirements Failed)
                      </span>
                    )}
                  </div>
                </div>

                {/* Table of Check Items */}
                <div className="divide-y divide-[#E7EAF0]">
                  {result.checks.map((check, checkIdx) => {
                    const isPassed = check.status === 'passed';
                    const isFailed = check.status === 'failed';

                    return (
                      <div
                        key={checkIdx}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {isPassed && <CheckCircle2 className="w-4 h-4 text-[#24B47E]" />}
                            {isFailed && <XCircle className="w-4 h-4 text-[#E05252]" />}
                            {!isPassed && !isFailed && <HelpCircle className="w-4 h-4 text-[#687386]" />}
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-[#182230] block mb-0.5">
                              {check.ruleName}
                            </span>
                            <p className="text-[#687386] leading-relaxed">
                              {check.message}
                            </p>
                          </div>
                        </div>

                        {/* Values & Action */}
                        <div className="flex items-center gap-4 sm:justify-end shrink-0 pl-7 sm:pl-0">
                          <div className="text-right">
                            <span className="block text-[11px] text-[#687386]">Expected: {check.expected}</span>
                            <span
                              className={`font-mono font-semibold ${
                                isPassed ? 'text-[#24B47E]' : isFailed ? 'text-[#E05252]' : 'text-[#182230]'
                              }`}
                            >
                              Found: {check.actual}
                            </span>
                          </div>

                          {/* Quick Fix Button using READYFILE tool */}
                          {check.suggestedToolSlug && onNavigateToTool && (
                            <button
                              onClick={() => onNavigateToTool(check.suggestedToolSlug!)}
                              className="px-3 py-1.5 rounded-lg bg-[#5278F5]/10 hover:bg-[#5278F5] text-[#5278F5] hover:text-white font-medium text-xs flex items-center gap-1 transition-colors"
                              title="Fix with READYFILE"
                            >
                              <span>Fix Issue</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
