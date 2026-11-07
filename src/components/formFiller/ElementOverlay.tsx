import React, { useRef, useState, useEffect } from 'react';
import { FormElement } from '../../types/formFiller';
import { Trash2, Check, X } from 'lucide-react';

interface ElementOverlayProps {
  element: FormElement;
  containerWidth: number;
  containerHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updated: FormElement) => void;
  onDelete: () => void;
}

export const ElementOverlay: React.FC<ElementOverlayProps> = ({
  element,
  containerWidth,
  containerHeight,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  const [isEditingInline, setIsEditingInline] = useState(false);
  const inlineInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Compute screen pixel bounding box from normalized percentages
  const left = element.x * containerWidth;
  const top = element.y * containerHeight;
  const width = Math.max(element.width * containerWidth, 18);
  const height = Math.max(element.height * containerHeight, 18);

  // Drag interaction state
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    elemX: number;
    elemY: number;
  } | null>(null);

  // Resize interaction state
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    elemW: number;
    elemH: number;
    handle: string;
  } | null>(null);

  useEffect(() => {
    if (isEditingInline && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [isEditingInline]);

  // Handle Dragging
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isEditingInline) return;
    e.stopPropagation();
    onSelect();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      elemX: element.x,
      elemY: element.y,
    };

    const handleDragMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      moveEvt.preventDefault();

      const curX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const curY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const deltaX = (curX - dragStartRef.current.startX) / containerWidth;
      const deltaY = (curY - dragStartRef.current.startY) / containerHeight;

      let newX = dragStartRef.current.elemX + deltaX;
      let newY = dragStartRef.current.elemY + deltaY;

      // Clamp within page boundaries
      newX = Math.max(0, Math.min(1 - element.width, newX));
      newY = Math.max(0, Math.min(1 - element.height, newY));

      onUpdate({
        ...element,
        x: newX,
        y: newY,
      });
    };

    const handleDragEnd = () => {
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };

    window.addEventListener('mousemove', handleDragMove, { passive: false });
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
  };

  // Handle Resizing
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    resizeStartRef.current = {
      startX: clientX,
      startY: clientY,
      elemW: element.width,
      elemH: element.height,
      handle,
    };

    const handleResizeMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!resizeStartRef.current) return;
      moveEvt.preventDefault();

      const curX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const curY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const deltaW = (curX - resizeStartRef.current.startX) / containerWidth;
      const deltaH = (curY - resizeStartRef.current.startY) / containerHeight;

      let newW = resizeStartRef.current.elemW;
      let newH = resizeStartRef.current.elemH;

      if (handle.includes('e')) {
        newW = Math.max(0.02, Math.min(1 - element.x, resizeStartRef.current.elemW + deltaW));
      }
      if (handle.includes('s')) {
        newH = Math.max(0.015, Math.min(1 - element.y, resizeStartRef.current.elemH + deltaH));
      }

      onUpdate({
        ...element,
        width: newW,
        height: newH,
      });
    };

    const handleResizeEnd = () => {
      resizeStartRef.current = null;
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('touchend', handleResizeEnd);
    };

    window.addEventListener('mousemove', handleResizeMove, { passive: false });
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchmove', handleResizeMove, { passive: false });
    window.addEventListener('touchend', handleResizeEnd);
  };

  // Compute scaled font size relative to rendered canvas width
  // (PDF base width ~ 595pt standard, scale font appropriately)
  const fontPt = element.fontSize || 12;
  const renderedFontSize = Math.max(9, (fontPt / 595) * containerWidth);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: isSelected ? 30 : 10,
      }}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (element.type === 'text' || element.type === 'date') {
          setIsEditingInline(true);
        } else if (element.type === 'checkbox') {
          onUpdate({ ...element, checked: !element.checked });
        }
      }}
      className={`group select-none cursor-move transition-shadow ${
        isSelected
          ? 'ring-2 ring-[#5278F5] ring-offset-1 shadow-sm'
          : 'hover:ring-1 hover:ring-[#5278F5]/50'
      }`}
    >
      {/* Element Content Rendering */}
      <div className="w-full h-full overflow-hidden flex items-center justify-center p-0.5 pointer-events-none">
        {element.type === 'text' || element.type === 'date' ? (
          isEditingInline ? (
            <textarea
              ref={inlineInputRef}
              value={element.text || ''}
              onChange={(e) => onUpdate({ ...element, text: e.target.value })}
              onBlur={() => setIsEditingInline(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                  setIsEditingInline(false);
                }
              }}
              style={{
                fontSize: `${renderedFontSize}px`,
                color: element.color || '#182230',
                fontFamily:
                  element.fontFamily === 'TimesRoman'
                    ? 'serif'
                    : element.fontFamily === 'Courier'
                    ? 'monospace'
                    : 'sans-serif',
                textAlign: element.textAlign || 'left',
              }}
              className="w-full h-full p-0.5 bg-white border border-[#5278F5] outline-none resize-none pointer-events-auto leading-tight"
            />
          ) : (
            <div
              style={{
                fontSize: `${renderedFontSize}px`,
                color: element.color || '#182230',
                fontFamily:
                  element.fontFamily === 'TimesRoman'
                    ? 'serif'
                    : element.fontFamily === 'Courier'
                    ? 'monospace'
                    : 'sans-serif',
                textAlign: element.textAlign || 'left',
                width: '100%',
                height: '100%',
                lineHeight: '1.2',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              className="flex items-center"
            >
              {element.text || (
                <span className="text-[#8A94A6] italic opacity-75">
                  {element.type === 'date' ? 'Date' : 'Double click to edit'}
                </span>
              )}
            </div>
          )
        ) : element.type === 'checkbox' ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ ...element, checked: !element.checked });
            }}
            style={{
              borderColor: element.color || '#182230',
            }}
            className="w-full h-full border border-[#182230] rounded-xs bg-white flex items-center justify-center pointer-events-auto cursor-pointer"
          >
            {element.checked && (
              element.checkboxStyle === 'cross' ? (
                <X
                  style={{ color: element.color || '#182230' }}
                  className="w-full h-full stroke-[3] p-0.5"
                />
              ) : element.checkboxStyle === 'fill' ? (
                <div
                  style={{ backgroundColor: element.color || '#182230' }}
                  className="w-3/4 h-3/4 rounded-2xs"
                />
              ) : (
                <Check
                  style={{ color: element.color || '#182230' }}
                  className="w-full h-full stroke-[3] p-0.5"
                />
              )
            )}
          </div>
        ) : element.type === 'signature' || element.type === 'image' ? (
          element.imageDataUrl ? (
            <img
              src={element.imageDataUrl}
              alt={element.type}
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-[#F4F6FA] flex items-center justify-center text-[10px] text-[#8A94A6]">
              {element.type}
            </div>
          )
        ) : null}
      </div>

      {/* Resize handles & floating mini toolbar when selected */}
      {isSelected && (
        <>
          {/* Delete button floating top-right */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete (Backspace)"
            className="absolute -top-3.5 -right-3.5 w-6 h-6 rounded-full bg-[#DC2626] text-white flex items-center justify-center shadow-md hover:bg-[#B91C1C] transition-colors cursor-pointer z-40"
          >
            <Trash2 className="w-3 h-3 stroke-[2.5]" />
          </button>

          {/* East (Right) Resize Handle */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'e')}
            onTouchStart={(e) => handleResizeStart(e, 'e')}
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#5278F5] cursor-ew-resize z-30 shadow-xs"
          />

          {/* South (Bottom) Resize Handle */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 's')}
            onTouchStart={(e) => handleResizeStart(e, 's')}
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#5278F5] cursor-ns-resize z-30 shadow-xs"
          />

          {/* South-East (Corner) Resize Handle */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            onTouchStart={(e) => handleResizeStart(e, 'se')}
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#5278F5] border-2 border-white cursor-nwse-resize z-30 shadow-xs"
          />
        </>
      )}
    </div>
  );
};
