import React from "react";
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Helper function to get features based on function key
  const getFunctionFeatures = (functionKey: string) => {
    switch (functionKey) {
      case 'image-enhancement':
        return ['Background removal', 'Lighting enhancement', 'Color correction', 'Style transfer'];
      case 'image-to-video':
        return ['Animation effects', '3D transforms', 'Motion graphics', 'Promotional clips'];
      case 'multiple-images-llm':
        return ['Multiple image upload', 'AI composition', 'Smart blending', 'Custom layouts'];
      default:
        return ['AI-powered processing', 'Professional results', 'Easy to use'];
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
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 border border-[#ffd700] bg-[#ffd700]/10 rounded-lg flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-[#ffd700]" />
          </div>
          <div>
            <h2 className="font-semibold text-white">AI Functions</h2>
            <p className="text-xs text-[#888888]">Select your workflow</p>
          </div>
        </div>
      </div>

      {/* Function Selection */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {functions.map((func) => {
            const IconComponent = getIconComponent(func.icon);
            const isSelected = selectedFunction === func.functionKey;
            const features = getFunctionFeatures(func.functionKey);
            
            return (
              <Card 
                key={func.id}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? 'bg-[#2a2a2a] border-[#ffd700] border-2' 
                    : 'bg-[#0f0f0f] border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
                onClick={() => {
                  if (isValidFunctionKey(func.functionKey)) {
                    onFunctionSelect(func.functionKey);
                  }
                }}
                data-testid={`function-card-${func.functionKey}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-[#ffd700]/20 border border-[#ffd700]' : 'bg-[#2a2a2a]'
                      }`}>
                        <IconComponent className={`w-5 h-5 ${
                          isSelected ? 'text-[#ffd700]' : 'text-[#e0e0e0]'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className={`text-sm ${
                          isSelected ? 'text-[#ffd700]' : 'text-white'
                        }`}>
                          {func.name}
                        </CardTitle>
                      </div>
                    </div>
                    {isSelected && (
                      <Sparkles className="w-4 h-4 text-[#ffd700]" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-[#888888] mb-3 leading-relaxed">
                    {func.description || `Advanced ${func.name.toLowerCase()} capabilities`}
                  </p>
                  <div className="space-y-1">
                    {features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-[#666666] rounded-full" />
                        <span className="text-xs text-[#aaaaaa]">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Help Section */}
      <div className="p-4 border-t border-[#2a2a2a]">
        <div className="text-xs text-[#888888] text-center">
          <p>Select a function above to get started</p>
          <p className="mt-1">Configure prompts for optimal results</p>
        </div>
      </div>
    </div>
  );
}