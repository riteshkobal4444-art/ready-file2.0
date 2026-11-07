import React from 'react';
import { 
  Minimize2, 
  Maximize2, 
  FileImage, 
  FileStack, 
  CheckCircle2, 
  Crop, 
  RefreshCw, 
  UserCheck, 
  PenTool, 
  Split, 
  FileDown, 
  Images, 
  RotateCw, 
  ArrowUpDown, 
  ListChecks,
  ArrowRight,
  Clock,
  Sparkles,
  Film,
  Scissors,
  VolumeX,
  Camera,
  Clapperboard,
  Video,
  FileText,
  FileSignature,
  Stamp
} from 'lucide-react';
import { ToolItem } from '../types';

const iconMap: Record<string, React.ElementType> = {
  Minimize2,
  Maximize2,
  FileImage,
  FileStack,
  FileText,
  FileSignature,
  Stamp,
  CheckCircle2,
  Crop,
  RefreshCw,
  UserCheck,
  PenTool,
  Split,
  FileDown,
  Images,
  RotateCw,
  ArrowUpDown,
  ListChecks,
  Film,
  Scissors,
  VolumeX,
  Camera,
  Clapperboard,
  Video,
};

interface ToolCardProps {
  tool: ToolItem;
  onSelect: (tool: ToolItem) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onSelect }) => {
  const IconComponent = iconMap[tool.icon] || FileImage;
  const isActive = tool.status === 'active';

  return (
    <div
      onClick={() => {
        if (isActive) {
          onSelect(tool);
        }
      }}
      role={isActive ? 'button' : undefined}
      tabIndex={isActive ? 0 : -1}
      aria-disabled={!isActive}
      onKeyDown={(e) => {
        if (isActive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(tool);
        }
      }}
      className={`group relative text-left bg-[#FFFFFF] border rounded-xl p-6 transition-all duration-200 flex flex-col justify-between ${
        isActive
          ? 'cursor-pointer border-[#E7EAF0] hover:border-[#5278F5]/40 hover:shadow-[0_4px_14px_0_rgba(24,34,48,0.06)]'
          : 'cursor-default border-[#E7EAF0] bg-[#FFFFFF] opacity-90 select-none shadow-none'
      }`}
    >
      <div>
        {/* Top row: Icon + Status Badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-[#5278F5]/10 text-[#5278F5] group-hover:bg-[#5278F5] group-hover:text-white'
                : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
            }`}
          >
            <IconComponent className="w-5 h-5 stroke-[1.8]" />
          </div>

          <div className="flex items-center gap-1.5">
            {isActive ? (
              <>
                {tool.badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#5278F5]/10 text-[#5278F5] border border-[#5278F5]/20">
                    {tool.badge}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#24B47E]/10 text-[#24B47E] border border-[#24B47E]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#24B47E]" />
                  Active
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300/80 shadow-xs">
                <Clock className="w-3 h-3 text-amber-600" />
                Coming Soon
              </span>
            )}
          </div>
        </div>

        {/* Title & Category */}
        <div className="mb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687386] mb-1">
            {tool.categoryName}
          </div>
          <h3 className={`font-['Plus_Jakarta_Sans'] font-semibold text-base transition-colors leading-snug ${
            isActive ? 'text-[#182230] group-hover:text-[#5278F5]' : 'text-[#182230]'
          }`}>
            {tool.name}
          </h3>
        </div>

        {/* Description */}
        <p className="text-xs text-[#687386] leading-relaxed line-clamp-2 mb-4">
          {tool.description}
        </p>
      </div>

      {/* Footer / CTA */}
      <div className="pt-3 border-t border-[#E7EAF0] flex items-center justify-between text-xs">
        {isActive ? (
          <>
            <span className="font-medium text-[#5278F5] group-hover:underline flex items-center gap-1">
              Launch tool
            </span>
            <div className="w-6 h-6 rounded-full bg-[#F4F6FA] text-[#5278F5] flex items-center justify-center group-hover:bg-[#5278F5] group-hover:text-white transition-all">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </>
        ) : (
          <>
            <span className="text-xs text-[#8A94A6] font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#8A94A6]" />
              Temporarily unavailable
            </span>
            <span className="text-[11px] font-semibold text-[#687386] px-2 py-0.5 rounded bg-[#F4F6FA] border border-[#E7EAF0]">
              {tool.plannedRelease || 'In development'}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
