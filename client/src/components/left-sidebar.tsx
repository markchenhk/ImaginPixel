import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings,
  Plus,
  MessageSquare,
  Images,
  Clock,
} from "lucide-react";
import type { Conversation } from "@shared/schema";

interface LeftSidebarProps {
  onSettingsClick: () => void;
  onNewChatClick: () => void;
  onConversationSelect: (conversationId: string) => void;
  onGalleryClick: () => void;
  currentConversationId: string | null;
  currentView: 'chat' | 'gallery';
}

interface ConversationWithMessages {
  conversation: Conversation;
  messages: any[];
}

export function LeftSidebar({ 
  onSettingsClick, 
  onNewChatClick,
  onConversationSelect,
  onGalleryClick,
  currentConversationId,
  currentView
}: LeftSidebarProps) {
  // Fetch conversation history
  const { data: conversations = [] } = useQuery<ConversationWithMessages[]>({
    queryKey: ['/api/conversations/history'],
  });

  const formatTimeAgo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return created.toLocaleDateString();
  };

  const truncateTitle = (title: string, maxLength: number = 30) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + "...";
  };

  return (
    <div className="w-64 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <Button
          onClick={onNewChatClick}
          className="w-full bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-medium mb-3"
          data-testid="new-chat-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
        
        {/* View Toggle */}
        <div className="flex rounded-lg bg-[#2a2a2a] p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => currentView !== 'chat' && onNewChatClick()}
            className={`flex-1 h-8 ${
              currentView === 'chat' 
                ? 'bg-[#ffd700] text-black hover:bg-[#ffd700]/90' 
                : 'text-[#e0e0e0] hover:bg-[#3a3a3a]'
            }`}
            data-testid="chat-view-button"
          >
            <MessageSquare className="w-3 h-3 mr-2" />
            Chat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onGalleryClick}
            className={`flex-1 h-8 ${
              currentView === 'gallery' 
                ? 'bg-[#ffd700] text-black hover:bg-[#ffd700]/90' 
                : 'text-[#e0e0e0] hover:bg-[#3a3a3a]'
            }`}
            data-testid="gallery-view-button"
          >
            <Images className="w-3 h-3 mr-2" />
            Gallery
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {currentView === 'chat' ? (
          <div className="p-2">
            {/* Recent Conversations Header */}
            <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-[#888888] uppercase tracking-wide">
              <Clock className="w-3 h-3" />
              Recent Chats
            </div>
            
            {/* Conversations List */}
            {conversations.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-[#888888]">
                No conversations yet
                <br />
                <span className="text-xs">Start a new chat to begin</span>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map(({ conversation }) => (
                  <Button
                    key={conversation.id}
                    variant="ghost"
                    onClick={() => onConversationSelect(conversation.id)}
                    className={`w-full justify-start h-auto p-3 text-left hover:bg-[#2a2a2a] transition-colors ${
                      currentConversationId === conversation.id 
                        ? 'bg-[#2a2a2a] border-l-2 border-[#ffd700]' 
                        : ''
                    }`}
                    data-testid={`conversation-${conversation.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#e0e0e0] truncate">
                            {truncateTitle(conversation.title)}
                          </p>
                          <p className="text-xs text-[#888888] mt-1">
                {formatTimeAgo(conversation.createdAt.toString())}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center">
            <Images className="w-12 h-12 mx-auto text-[#888888] mb-4" />
            <p className="text-sm text-[#e0e0e0] mb-2">Gallery View</p>
            <p className="text-xs text-[#888888]">
              Your saved images will appear in the main panel
            </p>
          </div>
        )}
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