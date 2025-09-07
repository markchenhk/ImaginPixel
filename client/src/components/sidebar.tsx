import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ImageIcon, 
  FolderOpen, 
  User, 
  BarChart3, 
  Shield, 
  CreditCard,
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  currentPath: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const navigationItems = [
    {
      icon: ImageIcon,
      label: "AI Image Editor",
      path: "/",
      testId: "nav-editor"
    },
    {
      icon: FolderOpen,
      label: "Gallery",
      path: "/gallery",
      testId: "nav-gallery"
    }
  ];

  const accountItems = [
    {
      icon: User,
      label: "Account Info",
      path: "/account",
      testId: "nav-account"
    },
    {
      icon: BarChart3,
      label: "Usage",
      path: "/usage",
      testId: "nav-usage"
    },
    {
      icon: Shield,
      label: "Security",
      path: "/security",
      testId: "nav-security"
    },
    {
      icon: CreditCard,
      label: "Billing",
      path: "/billing",
      testId: "nav-billing"
    }
  ];

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="w-16 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-[#2a2a2a]">
        <div className="w-8 h-8 border border-[#444444] rounded-lg flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-[#ffd700]" />
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4">
        <nav className="space-y-2 px-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            
            return (
              <Tooltip key={item.path} delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-12 h-12 p-0 rounded-xl transition-all ${
                      isActive
                        ? 'border border-[#ffd700] text-[#ffd700] bg-[#ffd700]/10 hover:bg-[#ffd700]/20'
                        : 'text-[#888888] hover:text-white hover:bg-[#2a2a2a]'
                    }`}
                    onClick={() => setLocation(item.path)}
                    data-testid={item.testId}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="ml-2">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </div>

      {/* Account Management */}
      <div className="border-t border-[#2a2a2a] py-4">
        <nav className="space-y-2 px-2">
          {accountItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            
            return (
              <Tooltip key={item.path} delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-12 h-12 p-0 rounded-xl transition-all ${
                      isActive
                        ? 'border border-[#ffd700] text-[#ffd700] bg-[#ffd700]/10 hover:bg-[#ffd700]/20'
                        : 'text-[#888888] hover:text-white hover:bg-[#2a2a2a]'
                    }`}
                    onClick={() => setLocation(item.path)}
                    data-testid={item.testId}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="ml-2">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          
          {/* Logout Button */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-12 h-12 p-0 rounded-xl text-[#888888] hover:text-red-400 hover:bg-[#2a2a2a] transition-all"
                onClick={handleLogout}
                data-testid="nav-logout"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>Logout</p>
            </TooltipContent>
          </Tooltip>
        </nav>

        {/* User Info */}
        <div className="px-2 mt-4">
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <div className="w-12 h-12 rounded-xl border border-[#444444] flex items-center justify-center">
                <div className="w-8 h-8 rounded-lg border border-[#555555] bg-[#2a2a2a] flex items-center justify-center">
                  <span className="text-xs font-semibold text-[#ffd700]">
                    {user?.firstName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>{user?.firstName ? `${user.firstName} ${user.lastName}` : user?.username}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}