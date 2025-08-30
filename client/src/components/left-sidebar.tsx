import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings,
  Wand2,
  Palette,
  Sparkles,
  Zap,
  Download,
  FolderOpen,
} from "lucide-react";

interface LeftSidebarProps {
  onSettingsClick: () => void;
}

export function LeftSidebar({ onSettingsClick }: LeftSidebarProps) {
  const navigationItems = [
    {
      id: "enhance",
      label: "AI Enhance",
      icon: Sparkles,
    },
    {
      id: "style",
      label: "Style Transfer",
      icon: Palette,
    },
    {
      id: "restore",
      label: "Image Restore",
      icon: Wand2,
    },
    {
      id: "upscale",
      label: "Upscale",
      icon: Zap,
    },
    {
      id: "gallery",
      label: "Gallery",
      icon: FolderOpen,
    },
    {
      id: "export",
      label: "Downloads",
      icon: Download,
    },
  ];

  const handleNavClick = (itemId: string) => {
    // Future functionality - trigger specific features
    console.log(`Clicked nav: ${itemId}`);
  };

  return (
    <div className="w-56 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      {/* Navigation Items */}
      <ScrollArea className="flex-1">
        <div className="p-2 pt-4">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Button
                key={item.id}
                variant="ghost"
                className="w-full justify-start mb-1 h-10 px-3 text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white transition-colors font-normal"
                onClick={() => handleNavClick(item.id)}
                data-testid={`nav-${item.id}`}
              >
                <IconComponent className="w-4 h-4 mr-3 text-[#888888]" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Settings at Bottom */}
      <div className="p-2 border-t border-[#2a2a2a]">
        <Button
          variant="ghost"
          className="w-full justify-start h-10 px-3 text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white transition-colors font-normal"
          onClick={onSettingsClick}
          data-testid="sidebar-settings-button"
        >
          <Settings className="w-4 h-4 mr-3 text-[#888888]" />
          Settings
        </Button>
      </div>
    </div>
  );
}