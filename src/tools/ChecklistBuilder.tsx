import React, { useState, useEffect } from 'react';
import { 
  ListChecks, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Printer, 
  Download, 
  RotateCcw, 
  PlusCircle, 
  FileText, 
  Check, 
  Sparkles,
  Info
} from 'lucide-react';
import { 
  Checklist, 
  ChecklistItem, 
  loadSavedChecklists, 
  saveChecklists, 
  exportChecklistToPdf 
} from '../services/checklistService';
import { downloadBlob, sanitizeFileName } from '../utils/fileHelpers';
import { ErrorMessage } from '../components/ErrorMessage';

export const ChecklistBuilder: React.FC = () => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [activeChecklistId, setActiveChecklistId] = useState<string>('template-1');
  const [newItemText, setNewItemText] = useState<string>('');
  const [isCreatingCustom, setIsCreatingCustom] = useState<boolean>(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState<string>('');
  const [newChecklistCategory, setNewChecklistCategory] = useState<string>('General');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadSavedChecklists();
    setChecklists(loaded);
    if (loaded.length > 0) {
      setActiveChecklistId(loaded[0].id);
    }
  }, []);

  const activeChecklist = checklists.find((c) => c.id === activeChecklistId) || checklists[0];

  const updateActiveChecklist = (updated: Checklist) => {
    const nextList = checklists.map((c) => (c.id === updated.id ? updated : c));
    setChecklists(nextList);
    saveChecklists(nextList);
  };

  const toggleItem = (itemId: string) => {
    if (!activeChecklist) return;
    const updatedItems = activeChecklist.items.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    updateActiveChecklist({ ...activeChecklist, items: updatedItems });
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChecklist || !newItemText.trim()) return;

    const newItem: ChecklistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      label: newItemText.trim(),
      completed: false,
    };

    updateActiveChecklist({
      ...activeChecklist,
      items: [...activeChecklist.items, newItem],
    });
    setNewItemText('');
  };

  const removeItem = (itemId: string) => {
    if (!activeChecklist) return;
    updateActiveChecklist({
      ...activeChecklist,
      items: activeChecklist.items.filter((item) => item.id !== itemId),
    });
  };

  const resetChecks = () => {
    if (!activeChecklist) return;
    const updatedItems = activeChecklist.items.map((item) => ({ ...item, completed: false }));
    updateActiveChecklist({ ...activeChecklist, items: updatedItems });
    setFeedbackMessage('All checkmarks cleared.');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistTitle.trim()) return;

    const newId = `custom-${Date.now()}`;
    const newChecklist: Checklist = {
      id: newId,
      title: newChecklistTitle.trim(),
      category: newChecklistCategory.trim() || 'Custom Checklist',
      isCustom: true,
      createdAt: new Date().toISOString(),
      items: [
        { id: `c-item-1`, label: 'Primary photo identification document', completed: false },
        { id: `c-item-2`, label: 'Signed official application form', completed: false },
      ],
    };

    const next = [...checklists, newChecklist];
    setChecklists(next);
    saveChecklists(next);
    setActiveChecklistId(newId);
    setNewChecklistTitle('');
    setIsCreatingCustom(false);
  };

  const handleDeleteChecklist = (id: string) => {
    if (checklists.length <= 1) return;
    const next = checklists.filter((c) => c.id !== id);
    setChecklists(next);
    saveChecklists(next);
    setActiveChecklistId(next[0].id);
  };

  const handleExportPdf = async () => {
    if (!activeChecklist) return;
    setIsExportingPdf(true);
    try {
      const pdfBlob = await exportChecklistToPdf(activeChecklist);
      const filename = sanitizeFileName(
        `${activeChecklist.title.toLowerCase().replace(/\s+/g, '_')}_checklist`,
        '',
        'pdf'
      );
      downloadBlob(pdfBlob, filename);
    } catch {
      // export error handling
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const completedCount = activeChecklist ? activeChecklist.items.filter((i) => i.completed).length : 0;
  const totalCount = activeChecklist ? activeChecklist.items.length : 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-6 sm:p-8">
        <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl sm:text-3xl text-[#182230] mb-2 tracking-tight">
          Document Checklist Builder
        </h1>
        <p className="text-sm text-[#687386] leading-relaxed max-w-2xl">
          Track, audit, and organize every credential required for official submissions. Choose from standardized application templates or craft your custom document verification checklist.
        </p>
      </div>

      {feedbackMessage && (
        <div className="bg-[#24B47E]/10 border border-[#24B47E]/20 text-[#24B47E] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Template Switcher Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#687386]">
            Select Application Template
          </span>
          <button
            type="button"
            onClick={() => setIsCreatingCustom(!isCreatingCustom)}
            className="text-xs font-semibold text-[#5278F5] hover:text-[#4165DC] flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCreatingCustom ? 'Cancel' : 'New Custom Checklist'}</span>
          </button>
        </div>

        {/* Custom Checklist Creation Drawer */}
        {isCreatingCustom && (
          <form
            onSubmit={handleCreateCustom}
            className="bg-[#FFFFFF] border border-[#5278F5]/30 rounded-xl p-4 sm:p-5 space-y-3 shadow-xs"
          >
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xs uppercase tracking-wider text-[#5278F5] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Custom Document Checklist</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">
                  Checklist Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mortgage Loan Closing Checklist"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E7EAF0] focus:outline-none focus:border-[#5278F5] bg-[#FFFFFF] text-[#182230]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">
                  Category Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. Financial / Legal"
                  value={newChecklistCategory}
                  onChange={(e) => setNewChecklistCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E7EAF0] focus:outline-none focus:border-[#5278F5] bg-[#FFFFFF] text-[#182230]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingCustom(false)}
                className="px-3 py-1.5 text-xs text-[#687386] hover:text-[#182230]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#5278F5] text-white text-xs font-semibold hover:bg-[#4165DC]"
              >
                Create Checklist
              </button>
            </div>
          </form>
        )}

        {/* Scrollable Template Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {checklists.map((c) => {
            const isActive = c.id === activeChecklistId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveChecklistId(c.id)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                  isActive
                    ? 'bg-[#5278F5] text-white border-[#5278F5] shadow-xs'
                    : 'bg-[#FFFFFF] text-[#687386] border-[#E7EAF0] hover:text-[#182230] hover:bg-[#F4F6FA]'
                }`}
              >
                <span>{c.title}</span>
                {c.isCustom && (
                  <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-white/20' : 'bg-[#E7EAF0]'}`}>
                    Custom
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Checklist Card */}
      {activeChecklist && (
        <div className="bg-[#FFFFFF] border border-[#E7EAF0] rounded-xl p-5 sm:p-7 space-y-6 shadow-sm">
          {/* Header of Active Checklist */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E7EAF0]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#5278F5]/10 text-[#5278F5]">
                  {activeChecklist.category}
                </span>
                {activeChecklist.isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklist(activeChecklist.id)}
                    className="text-[11px] text-[#E05252] hover:underline flex items-center gap-0.5 ml-2"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete custom list</span>
                  </button>
                )}
              </div>
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#182230]">
                {activeChecklist.title}
              </h2>
            </div>

            {/* Quick Export / Print Tools */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetChecks}
                title="Uncheck all items"
                className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] hover:bg-[#F4F6FA] text-xs font-medium text-[#687386] hover:text-[#182230] flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Checks</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-lg border border-[#E7EAF0] bg-[#F4F6FA] hover:bg-[#E7EAF0] text-xs font-semibold text-[#182230] flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-[#5278F5]" />
                <span className="hidden sm:inline">Print</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="px-3.5 py-1.5 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            </div>
          </div>

          {/* Progress Tracker */}
          <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#182230]">
                Verification Progress: {completedCount} of {totalCount} items verified
              </span>
              <span className="font-mono font-bold text-[#5278F5]">
                {progressPercent}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-[#E7EAF0] overflow-hidden">
              <div
                className="h-full bg-[#24B47E] transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Items Checklist List */}
          <div className="space-y-2">
            {activeChecklist.items.map((item, idx) => {
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    item.completed
                      ? 'bg-[#F4F6FA]/60 border-[#E7EAF0]'
                      : 'bg-[#FFFFFF] border-[#E7EAF0] hover:border-[#5278F5]/40 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 select-none flex-1">
                    <button
                      type="button"
                      aria-label="Toggle completed"
                      className="text-[#5278F5] focus:outline-none"
                    >
                      {item.completed ? (
                        <div className="w-5 h-5 rounded bg-[#24B47E] flex items-center justify-center text-white">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded border-2 border-[#687386]/40 hover:border-[#5278F5] bg-white transition-colors" />
                      )}
                    </button>

                    <span
                      className={`text-xs leading-relaxed ${
                        item.completed
                          ? 'line-through text-[#687386]'
                          : 'font-medium text-[#182230]'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  {/* Remove Item */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#687386] hover:text-[#E05252] transition-opacity"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add custom item form */}
          <form onSubmit={addItem} className="flex gap-2 pt-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add another required document or note..."
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E7EAF0] focus:outline-none focus:border-[#5278F5] bg-[#FFFFFF] text-[#182230]"
            />
            <button
              type="submit"
              disabled={!newItemText.trim()}
              className="px-4 py-2 rounded-lg bg-[#5278F5] hover:bg-[#4165DC] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </form>

          {/* Official Verification Notice */}
          <div className="bg-[#F4F6FA] border border-[#E7EAF0] rounded-lg p-3.5 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#5278F5] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#687386] leading-relaxed">
              <strong>Official Notice:</strong> Document prerequisites and filing formats differ across agencies, consulates, and universities. Verify all required credentials directly with the issuing portal before attending appointments or submitting files.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
