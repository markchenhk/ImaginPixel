import { Home, Music, Film, Volume2, Mic, Image, FileText, Zap, Wrench, Star, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarItem {
  icon: any;
  label: string;
  isActive?: boolean;
}

const sidebarItems: SidebarItem[] = [
  { icon: Home, label: 'Home', isActive: true },
  { icon: Music, label: 'Music' },
  { icon: Film, label: 'Footage' },
  { icon: Volume2, label: 'Sound Effects' },
  { icon: Mic, label: 'AI Voiceover' },
  { icon: Image, label: 'AI Image & Video' },
  { icon: FileText, label: 'Templates' },
  { icon: Zap, label: 'LUTs' },
  { icon: Wrench, label: 'Tools' },
];

const bottomItems: SidebarItem[] = [
  { icon: Star, label: 'Favorites' },
  { icon: Download, label: 'Downloads' },
  { icon: Search, label: 'Spotlight' },
];

export default function Sidebar() {
  return (
    <div className="w-60 bg-gray-900 text-gray-100 flex flex-col h-full border-r border-gray-800">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-yellow-400">Artlist</h1>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.label}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800",
                  item.isActive && "bg-gray-800 text-white"
                )}
                data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-4 h-4 mr-3" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Artboards Section */}
      <div className="border-t border-gray-800 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Artboards</h3>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            + Create Artboard
          </Button>
        </div>
        
        <div className="space-y-2 text-xs text-gray-400">
          <p>Use the power of AI to discover assets for your next project</p>
          <Button 
            size="sm" 
            className="w-full text-xs bg-gray-800 hover:bg-gray-700"
          >
            Create Artboard
          </Button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-800 py-4">
        <nav className="space-y-1 px-3">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.label}
                variant="ghost"
                className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-4 h-4 mr-3" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}