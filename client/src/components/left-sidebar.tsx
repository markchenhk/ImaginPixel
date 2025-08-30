import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  History,
  User,
  Palette,
  Wand2,
  FolderOpen,
  Download,
  Upload,
  Sparkles,
  Image,
  Layers,
  Zap,
} from "lucide-react";

interface LeftSidebarProps {
  onSettingsClick: () => void;
}

export function LeftSidebar({ onSettingsClick }: LeftSidebarProps) {
  const [activeSection, setActiveSection] = useState<string>("tools");

  const toolButtons = [
    {
      id: "enhance",
      label: "Enhance",
      icon: Sparkles,
      description: "AI image enhancement",
    },
    {
      id: "style",
      label: "Style Transfer",
      icon: Palette,
      description: "Apply artistic styles",
    },
    {
      id: "restore",
      label: "Restore",
      icon: Wand2,
      description: "Fix damaged images",
    },
    {
      id: "upscale",
      label: "Upscale",
      icon: Zap,
      description: "Increase resolution",
    },
    {
      id: "layers",
      label: "Layers",
      icon: Layers,
      description: "Layer management",
    },
  ];

  const actionButtons = [
    {
      id: "import",
      label: "Import",
      icon: Upload,
      description: "Import images",
    },
    {
      id: "export",
      label: "Export",
      icon: Download,
      description: "Export results",
    },
    {
      id: "gallery",
      label: "Gallery",
      icon: FolderOpen,
      description: "Browse gallery",
    },
  ];

  const handleToolClick = (toolId: string) => {
    // Future functionality - trigger specific AI tools
    console.log(`Clicked tool: ${toolId}`);
  };

  const handleActionClick = (actionId: string) => {
    // Future functionality - trigger specific actions
    console.log(`Clicked action: ${actionId}`);
  };

  return (
    <div className="w-64 h-full border-r border-border/50 bg-gradient-to-b from-card to-muted/10 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Image className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">AI Tools</h2>
            <p className="text-xs text-muted-foreground">Quick actions</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-secondary/50 rounded-lg p-1">
          <button
            onClick={() => setActiveSection("tools")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeSection === "tools"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tools-tab"
          >
            Tools
          </button>
          <button
            onClick={() => setActiveSection("actions")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeSection === "actions"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="actions-tab"
          >
            Actions
          </button>
        </div>
      </div>

      {/* Content Area */}
      <ScrollArea className="flex-1 p-4">
        {activeSection === "tools" && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              AI Enhancement Tools
            </p>
            {toolButtons.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <Button
                  key={tool.id}
                  variant="ghost"
                  className="w-full justify-start h-auto p-3 text-left hover:bg-secondary/50 transition-all group"
                  onClick={() => handleToolClick(tool.id)}
                  data-testid={`tool-${tool.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center group-hover:from-blue-200 group-hover:to-purple-200 transition-colors">
                      <IconComponent className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{tool.label}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {tool.description}
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        )}

        {activeSection === "actions" && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Quick Actions
            </p>
            {actionButtons.map((action) => {
              const IconComponent = action.icon;
              return (
                <Button
                  key={action.id}
                  variant="ghost"
                  className="w-full justify-start h-auto p-3 text-left hover:bg-secondary/50 transition-all group"
                  onClick={() => handleActionClick(action.id)}
                  data-testid={`action-${action.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center group-hover:from-green-200 group-hover:to-emerald-200 transition-colors">
                      <IconComponent className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{action.label}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Bottom Section */}
      <div className="p-4 space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {}}
          data-testid="history-button"
        >
          <History className="w-4 h-4 mr-3" />
          History
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          data-testid="profile-button"
        >
          <User className="w-4 h-4 mr-3" />
          Profile
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={onSettingsClick}
          data-testid="sidebar-settings-button"
        >
          <Settings className="w-4 h-4 mr-3" />
          Settings
        </Button>
      </div>
    </div>
  );
}