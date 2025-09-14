import React from "react";
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ApplicationFunction } from '@shared/schema';
import * as LucideIcons from "lucide-react";
import {
  Wand2,
  Video,
  ImageIcon,
  Sparkles,
} from "lucide-react";

interface LeftSidebarProps {
  selectedFunction: 'image-enhancement' | 'image-to-video' | 'multiple-images-llm';
  onFunctionSelect: (functionKey: 'image-enhancement' | 'image-to-video' | 'multiple-images-llm') => void;
}

export function LeftSidebar({ 
  selectedFunction,
  onFunctionSelect
}: LeftSidebarProps) {
  // Fetch enabled application functions from API
  const { data: functions = [], isLoading, error } = useQuery<ApplicationFunction[]>({
    queryKey: ['/api/application-functions'],
    refetchOnWindowFocus: false,
  });

  // Helper function to get icon component from icon name
  const getIconComponent = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || Wand2; // fallback to Wand2 if icon not found
  };

  // Type guard to ensure function key is valid
  const isValidFunctionKey = (key: string): key is 'image-enhancement' | 'image-to-video' | 'multiple-images-llm' => {
    return key === 'image-enhancement' || key === 'image-to-video' || key === 'multiple-images-llm';
  };

  // Helper function to get short descriptions
  const getShortDescription = (functionKey: string) => {
    switch (functionKey) {
      case 'image-enhancement':
        return 'Background removal, lighting & style enhancement';
      case 'image-to-video':
        return 'Create engaging videos with animations & effects';
      case 'multiple-images-llm':
        return 'Combine multiple images using AI composition';
      default:
        return 'AI-powered processing';
    }
  };

  if (isLoading) {
    return (
      <div className="w-80 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex items-center justify-center">
        <div className="text-[#888888]">Loading functions...</div>
      </div>
    );
  }

  if (error || functions.length === 0) {
    return (
      <div className="w-80 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex items-center justify-center">
        <div className="text-[#888888] text-center">
          <p>No functions available</p>
          {error && <p className="text-xs mt-1">Error loading functions</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 border border-[#ffd700] bg-[#ffd700]/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#ffd700]" />
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">AI Functions</h2>
            <p className="text-xs text-[#888888]">Select your workflow</p>
          </div>
        </div>
      </div>

      {/* Function Selection */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {functions.map((func) => {
            const IconComponent = getIconComponent(func.icon);
            const isSelected = selectedFunction === func.functionKey;
            const shortDesc = getShortDescription(func.functionKey);
            
            return (
              <div
                key={func.id}
                className={cn(
                  "relative cursor-pointer transition-all duration-200 rounded-lg p-3",
                  "border border-transparent hover:border-[#3a3a3a]",
                  isSelected 
                    ? "bg-[#ffd700] text-black border-[#ffd700]" 
                    : "bg-[#0f0f0f] hover:bg-[#1a1a1a]"
                )}
                onClick={() => {
                  if (isValidFunctionKey(func.functionKey)) {
                    onFunctionSelect(func.functionKey);
                  }
                }}
                data-testid={`function-item-${func.functionKey}`}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    isSelected ? "bg-black/10" : "bg-[#2a2a2a]"
                  )}>
                    <IconComponent className={cn(
                      "w-4 h-4",
                      isSelected ? "text-black" : "text-[#e0e0e0]"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      "font-medium text-sm leading-tight",
                      isSelected ? "text-black" : "text-white"
                    )}>
                      {func.name}
                    </h3>
                    <p className={cn(
                      "text-xs mt-1 leading-tight",
                      isSelected ? "text-black/70" : "text-[#888888]"
                    )}>
                      {shortDesc}
                    </p>
                  </div>
                  {isSelected && (
                    <Sparkles className="w-4 h-4 text-black flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Help Section */}
      <div className="px-3 py-2 border-t border-[#2a2a2a]">
        <p className="text-xs text-[#888888] text-center leading-relaxed">
          Select a function to get started
        </p>
      </div>
    </div>
  );
}