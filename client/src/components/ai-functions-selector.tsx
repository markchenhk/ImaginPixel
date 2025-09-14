import React from "react";
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationFunction } from '@shared/schema';
import * as LucideIcons from "lucide-react";
import {
  Wand2,
  Video,
  ImageIcon,
  Sparkles,
  Settings,
} from "lucide-react";

interface AIFunctionsSelectorProps {
  selectedFunction: 'image-enhancement' | 'image-to-video';
  onFunctionSelect: (functionKey: 'image-enhancement' | 'image-to-video') => void;
}

export function AIFunctionsSelector({ 
  selectedFunction,
  onFunctionSelect
}: AIFunctionsSelectorProps) {
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
  const isValidFunctionKey = (key: string): key is 'image-enhancement' | 'image-to-video' => {
    return key === 'image-enhancement' || key === 'image-to-video';
  };

  // Enhanced function features based on the design
  const getFunctionFeatures = (functionKey: string) => {
    switch (functionKey) {
      case 'image-enhancement':
        return [
          'Background removal',
          'Lighting enhancement', 
          'Color correction',
          'Style transfer'
        ];
      case 'image-to-video':
        return [
          'Animation effects',
          '3D transforms',
          'Motion graphics', 
          'Promotional clips'
        ];
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

  // Fallback to built-in functions if API fails or returns empty
  const fallbackFunctions = [
    {
      id: 'fallback-1',
      functionKey: 'image-enhancement',
      name: 'Product Image Enhancement',
      description: 'Enhance product images with background removal, color correction, and style transfer',
      icon: 'Wand2',
      enabled: 'true'
    },
    {
      id: 'fallback-2', 
      functionKey: 'image-to-video',
      name: 'Product Image to Video',
      description: 'Convert product images into engaging video content with animations and effects',
      icon: 'Video',
      enabled: 'true'
    }
  ];

  const functionsToUse = (error || functions.length === 0) ? fallbackFunctions : functions;

  return (
    <div className="w-80 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 border border-[#ffd700] bg-[#ffd700]/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#ffd700]" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">AI Functions</h2>
          </div>
        </div>
        <p className="text-sm text-[#888888]">Select your workflow</p>
      </div>

      {/* Function Selection Cards */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {functionsToUse.map((func) => {
            const IconComponent = getIconComponent(func.icon);
            const isSelected = selectedFunction === func.functionKey;
            const features = getFunctionFeatures(func.functionKey);
            
            return (
              <Card 
                key={func.id}
                className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                  isSelected 
                    ? 'bg-gradient-to-br from-[#ffd700]/20 to-[#ffd700]/5 border-[#ffd700] border-2 shadow-lg shadow-[#ffd700]/20' 
                    : 'bg-[#0f0f0f] border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1a1a1a]'
                }`}
                onClick={() => {
                  if (isValidFunctionKey(func.functionKey)) {
                    onFunctionSelect(func.functionKey);
                  }
                }}
                data-testid={`function-card-${func.functionKey}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isSelected 
                        ? 'bg-[#ffd700] shadow-lg shadow-[#ffd700]/30' 
                        : 'bg-[#2a2a2a]'
                    }`}>
                      <IconComponent className={`w-6 h-6 ${
                        isSelected ? 'text-black' : 'text-[#e0e0e0]'
                      }`} />
                      {isSelected && (
                        <Settings className="w-3 h-3 absolute top-1 right-1 text-[#ffd700]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className={`text-base font-bold ${
                        isSelected ? 'text-[#ffd700]' : 'text-white'
                      }`}>
                        {func.name}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-[#888888] mb-4 leading-relaxed">
                    {func.description}
                  </p>
                  
                  {/* Feature List */}
                  <ul className="space-y-2">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-[#cccccc]">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-[#ffd700]' : 'bg-[#888888]'
                        }`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-6 border-t border-[#2a2a2a] text-center">
        <p className="text-sm text-[#888888] leading-relaxed">
          Select a function above to get started<br />
          Configure prompts for optimal results
        </p>
      </div>
    </div>
  );
}