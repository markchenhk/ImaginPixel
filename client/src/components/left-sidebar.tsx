import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wand2,
  Video,
  ImageIcon,
  Sparkles,
  Settings2,
  ChevronRight,
} from "lucide-react";

interface LeftSidebarProps {
  selectedFunction: 'image-enhancement' | 'image-to-video';
  onFunctionSelect: (functionType: 'image-enhancement' | 'image-to-video') => void;
  onConfigureFunction: (functionType: 'image-enhancement' | 'image-to-video') => void;
}

export function LeftSidebar({ 
  selectedFunction,
  onFunctionSelect,
  onConfigureFunction
}: LeftSidebarProps) {
  const functions = [
    {
      id: 'image-enhancement' as const,
      title: 'Product Image Enhancement',
      description: 'Transform product photos into professional marketplace-ready images',
      icon: Wand2,
      features: ['Background removal', 'Lighting enhancement', 'Color correction', 'Style transfer']
    },
    {
      id: 'image-to-video' as const,
      title: 'Product Image to Video',
      description: 'Convert static product images into engaging promotional videos',
      icon: Video,
      features: ['Animation effects', '3D transforms', 'Motion graphics', 'Promotional clips']
    }
  ];

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
            const IconComponent = func.icon;
            const isSelected = selectedFunction === func.id;
            
            return (
              <Card 
                key={func.id}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? 'bg-[#2a2a2a] border-[#ffd700] border-2' 
                    : 'bg-[#0f0f0f] border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
                onClick={() => onFunctionSelect(func.id)}
                data-testid={`function-card-${func.id}`}
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
                          {func.title}
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
                    {func.description}
                  </p>
                  <div className="space-y-1">
                    {func.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-[#666666] rounded-full" />
                        <span className="text-xs text-[#aaaaaa]">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  {isSelected && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfigureFunction(func.id);
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700]/10 text-xs"
                      data-testid={`configure-${func.id}`}
                    >
                      <Settings2 className="w-3 h-3 mr-2" />
                      Configure Prompts
                      <ChevronRight className="w-3 h-3 ml-auto" />
                    </Button>
                  )}
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