import React from 'react';
import { 
  Trash2, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Type, 
  Calendar, 
  CheckSquare, 
  PenTool, 
  Image as ImageIcon,
  Check,
  X,
  Square,
  Copy
} from 'lucide-react';
import { FormElement, FontFamily, CheckboxStyle } from '../../types/formFiller';

interface PropertiesPanelProps {
  element: FormElement | null;
  onUpdateElement: (updated: FormElement) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (element: FormElement) => void;
  onClose?: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  element,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
}) => {
  if (!element) {
    return (
      <div className="p-5 text-center text-[#687386] space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#F4F6FA] text-[#687386] flex items-center justify-center mx-auto">
          <Type className="w-6 h-6 stroke-[1.5]" />
        </div>
        <div>
          <h4 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#182230] mb-1">
            Properties Panel
          </h4>
          <p className="text-xs text-[#687386] leading-relaxed">
            Click on any inserted element on the PDF page or use the toolbar above to edit its text, font size, color, and positioning.
          </p>
        </div>
        <div className="p-3 bg-[#FAFBFC] border border-[#E7EAF0] rounded-lg text-left text-[11px] space-y-1.5">
          <div className="font-semibold text-[#182230]">Quick Shortcuts:</div>
          <div>• <span className="font-medium text-[#182230]">Delete / Backspace:</span> Delete selected element</div>
          <div>• <span className="font-medium text-[#182230]">Ctrl + Z / ⌘ + Z:</span> Undo previous action</div>
          <div>• <span className="font-medium text-[#182230]">Ctrl + Y / ⌘ + Y:</span> Redo action</div>
        </div>
      </div>
    );
  }

  const isTextLike = element.type === 'text' || element.type === 'date';

  return (
    <div className="p-4 space-y-5 text-xs text-[#182230]">
      {/* Element Header */}
      <div className="flex items-center justify-between border-b border-[#E7EAF0] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#5278F5]/10 text-[#5278F5] flex items-center justify-center font-bold">
            {element.type === 'text' && <Type className="w-3.5 h-3.5" />}
            {element.type === 'date' && <Calendar className="w-3.5 h-3.5" />}
            {element.type === 'checkbox' && <CheckSquare className="w-3.5 h-3.5" />}
            {element.type === 'signature' && <PenTool className="w-3.5 h-3.5" />}
            {element.type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
          </div>
          <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm capitalize">
            {element.type} Element
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onDuplicateElement(element)}
            title="Duplicate Element"
            className="p-1.5 rounded hover:bg-[#F4F6FA] text-[#687386] hover:text-[#182230] cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteElement(element.id)}
            title="Delete Element"
            className="p-1.5 rounded hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Text / Date Editor */}
      {isTextLike && (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#687386] uppercase tracking-wider mb-1">
              {element.type === 'date' ? 'Date Value' : 'Text Content'}
            </label>
            <textarea
              value={element.text || ''}
              onChange={(e) => onUpdateElement({ ...element, text: e.target.value })}
              rows={element.type === 'date' ? 1 : 3}
              placeholder={element.type === 'date' ? 'DD/MM/YYYY' : 'Enter text...'}
              className="w-full px-3 py-2 border border-[#E7EAF0] rounded-lg text-xs focus:outline-none focus:border-[#5278F5] bg-[#FFFFFF]"
            />
            {element.type === 'date' && (
              <button
                onClick={() => {
                  const now = new Date();
                  const dd = String(now.getDate()).padStart(2, '0');
                  const mm = String(now.getMonth() + 1).padStart(2, '0');
                  const yyyy = now.getFullYear();
                  onUpdateElement({ ...element, text: `${dd}/${mm}/${yyyy}` });
                }}
                className="mt-1 text-[11px] text-[#5278F5] hover:underline cursor-pointer font-medium"
              >
                Set Today's Date
              </button>
            )}
          </div>

          {/* Typography: Font size & Family */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#687386] mb-1">
                Font Size (pt)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={8}
                  max={64}
                  value={element.fontSize || 12}
                  onChange={(e) =>
                    onUpdateElement({
                      ...element,
                      fontSize: Math.max(8, Math.min(64, parseInt(e.target.value) || 12)),
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-[#E7EAF0] rounded-lg text-xs focus:outline-none focus:border-[#5278F5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#687386] mb-1">
                Font Family
              </label>
              <select
                value={element.fontFamily || 'Helvetica'}
                onChange={(e) =>
                  onUpdateElement({ ...element, fontFamily: e.target.value as FontFamily })
                }
                className="w-full px-2.5 py-1.5 border border-[#E7EAF0] rounded-lg text-xs focus:outline-none focus:border-[#5278F5] bg-white cursor-pointer"
              >
                <option value="Helvetica">Helvetica (Sans)</option>
                <option value="TimesRoman">Times New Roman (Serif)</option>
                <option value="Courier">Courier (Monospace)</option>
              </select>
            </div>
          </div>

          {/* Alignment */}
          <div>
            <label className="block text-[11px] font-semibold text-[#687386] mb-1">
              Alignment
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-[#F4F6FA] p-1 rounded-lg border border-[#E7EAF0]">
              {[
                { val: 'left', icon: AlignLeft, label: 'Left' },
                { val: 'center', icon: AlignCenter, label: 'Center' },
                { val: 'right', icon: AlignRight, label: 'Right' },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = (element.textAlign || 'left') === item.val;
                return (
                  <button
                    key={item.val}
                    onClick={() =>
                      onUpdateElement({ ...element, textAlign: item.val as any })
                    }
                    className={`py-1 flex items-center justify-center rounded text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white shadow-xs text-[#5278F5] font-semibold'
                        : 'text-[#687386] hover:text-[#182230]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Checkbox Controls */}
      {element.type === 'checkbox' && (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#687386] mb-1">
              State
            </label>
            <button
              onClick={() => onUpdateElement({ ...element, checked: !element.checked })}
              className={`w-full py-2 px-3 rounded-lg border flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors ${
                element.checked
                  ? 'bg-[#24B47E]/10 border-[#24B47E]/30 text-[#047857]'
                  : 'bg-[#F4F6FA] border-[#E7EAF0] text-[#687386]'
              }`}
            >
              <span>{element.checked ? 'Checked' : 'Unchecked'}</span>
              <span className={`w-4 h-4 rounded flex items-center justify-center ${
                element.checked ? 'bg-[#24B47E] text-white' : 'border border-[#C4C5D6] bg-white'
              }`}>
                {element.checked && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#687386] mb-1">
              Mark Style
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-[#F4F6FA] p-1 rounded-lg border border-[#E7EAF0]">
              {[
                { val: 'check', icon: Check, label: 'Check' },
                { val: 'cross', icon: X, label: 'Cross' },
                { val: 'fill', icon: Square, label: 'Filled' },
              ].map((styleItem) => {
                const Icon = styleItem.icon;
                const isSelected = (element.checkboxStyle || 'check') === styleItem.val;
                return (
                  <button
                    key={styleItem.val}
                    onClick={() =>
                      onUpdateElement({
                        ...element,
                        checkboxStyle: styleItem.val as CheckboxStyle,
                      })
                    }
                    className={`py-1.5 flex items-center justify-center gap-1 rounded text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white shadow-xs text-[#5278F5] font-semibold'
                        : 'text-[#687386] hover:text-[#182230]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[11px]">{styleItem.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Signature & Image controls */}
      {(element.type === 'signature' || element.type === 'image') && (
        <div className="space-y-3">
          <label className="block text-[11px] font-semibold text-[#687386] mb-1">
            Preview
          </label>
          {element.imageDataUrl ? (
            <div className="border border-[#E7EAF0] rounded-lg p-2 bg-[#FAFBFC] flex items-center justify-center">
              <img
                src={element.imageDataUrl}
                alt="Asset preview"
                className="max-h-20 max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="text-xs text-[#8A94A6]">No image data available</div>
          )}
        </div>
      )}

      {/* Color Palette (for text, date, and checkmarks) */}
      {(isTextLike || element.type === 'checkbox') && (
        <div>
          <label className="block text-[11px] font-semibold text-[#687386] mb-1.5">
            Color
          </label>
          <div className="flex items-center gap-2">
            {[
              { hex: '#182230', label: 'Dark Charcoal' },
              { hex: '#002B49', label: 'Navy' },
              { hex: '#1E40AF', label: 'Blue' },
              { hex: '#DC2626', label: 'Red' },
              { hex: '#047857', label: 'Green' },
            ].map((c) => (
              <button
                key={c.hex}
                onClick={() => onUpdateElement({ ...element, color: c.hex })}
                title={c.label}
                style={{ backgroundColor: c.hex }}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                  (element.color || '#182230') === c.hex
                    ? 'ring-2 ring-offset-2 ring-[#5278F5] scale-110'
                    : 'hover:scale-105'
                }`}
              />
            ))}
            <input
              type="color"
              value={element.color || '#182230'}
              onChange={(e) => onUpdateElement({ ...element, color: e.target.value })}
              title="Custom Color"
              className="w-7 h-7 rounded border border-[#E7EAF0] p-0.5 cursor-pointer bg-white"
            />
          </div>
        </div>
      )}

      {/* Position metrics */}
      <div className="pt-3 border-t border-[#E7EAF0] text-[11px] text-[#687386] space-y-1">
        <div className="flex justify-between">
          <span>Page:</span>
          <span className="font-medium text-[#182230]">{element.pageIndex + 1}</span>
        </div>
        <div className="flex justify-between">
          <span>X / Y (%):</span>
          <span className="font-mono text-[#182230]">
            {Math.round(element.x * 100)}% / {Math.round(element.y * 100)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Width / Height:</span>
          <span className="font-mono text-[#182230]">
            {Math.round(element.width * 100)}% / {Math.round(element.height * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
