import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Settings, Wand2, Home, ArrowLeft, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { InputSidebar } from '@/components/input-sidebar';
import { ImageOutputPanel } from '@/components/image-output-panel';
import ModelConfig from '@/components/model-config';
import UserLibraryPanel from '@/components/user-library-panel';
import { LeftSidebar } from '@/components/left-sidebar';
import { GalleryView } from '@/components/gallery-view';
import { getModelDisplayName } from '@/lib/openrouter';
import type { Conversation, ModelConfiguration } from '@shared/schema';

export default function ImageEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'chat' | 'gallery'>('chat');

  // Fetch model configuration for header display (admin only)
  const { data: modelConfig } = useQuery<ModelConfiguration>({
    queryKey: ['/api/model-config'],
    enabled: isAdmin, // Only fetch if user is admin
  });

  const handleConversationCreate = (conversation: Conversation) => {
    setCurrentConversation(conversation);
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setCurrentView('chat');
  };

  const handleConversationSelect = (conversationId: string) => {
    // Find the conversation from query cache or set it directly
    setCurrentConversation({ id: conversationId } as Conversation);
    setCurrentView('chat');
  };

  const handleGalleryClick = () => {
    setCurrentView('gallery');
  };

  const handleImageProcessed = (originalUrl: string, processedUrl: string) => {
    setOriginalImageUrl(originalUrl);
    setProcessedImageUrl(processedUrl);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between bg-[#1a1a1a]">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white"
            data-testid="button-home"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Home
          </Button>
          <div className="w-px h-6 bg-[#2a2a2a]" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#ffd700] rounded-lg flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-black" />
            </div>
            <h1 className="text-lg font-semibold text-white">
              AI Image Editor
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* User Display */}
          {user && (
            <div className="flex items-center gap-2 text-sm text-[#e0e0e0]">
              {user.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt="Profile" 
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span data-testid="user-name">
                {user.firstName} {user.lastName}
              </span>
              {isAdmin && (
                <Badge variant="secondary" className="text-xs bg-[#ffd700] text-black">
                  Admin
                </Badge>
              )}
            </div>
          )}
          
          {/* Model Status Indicator (admin only) */}
          {isAdmin && (
            <div className="flex items-center gap-2 text-sm text-[#e0e0e0]">
              <div className={`w-2 h-2 rounded-full ${
                modelConfig?.apiKeyConfigured === 'true' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span data-testid="selected-model">
                {getModelDisplayName(modelConfig?.selectedModel || 'openai/gpt-4o')}
              </span>
            </div>
          )}
          
          
          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = "/api/logout"}
            data-testid="logout-button"
            className="text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar 
          onSettingsClick={isAdmin ? () => setConfigOpen(true) : () => {}}
          onNewChatClick={handleNewChat}
          onConversationSelect={handleConversationSelect}
          onGalleryClick={handleGalleryClick}
          currentConversationId={currentConversation?.id || null}
          currentView={currentView}
          showSettings={isAdmin}
        />
        
        {/* Main Content Area */}
        {currentView === 'chat' ? (
          <div className="flex-1 flex">
            <InputSidebar 
              conversationId={currentConversation?.id || 'new'}
              onImageGenerated={() => {
                // Refresh conversations when a new image is generated
                queryClient.invalidateQueries({ 
                  queryKey: ['/api/conversations'] 
                });
              }}
            />
            <ImageOutputPanel 
              conversationId={currentConversation?.id || 'new'}
              onSaveToLibrary={async (messageId: string) => {
                try {
                  // First get the message to find the image URL
                  const response = await fetch(`/api/conversations/${currentConversation?.id}/messages`);
                  const messages = await response.json();
                  const message = messages.find((m: any) => m.id === messageId);
                  
                  if (!message?.imageUrl) {
                    throw new Error('Image not found');
                  }

                  const saveResponse = await fetch('/api/library/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: user?.id || '',
                      title: `Generated image from ${new Date().toLocaleDateString()}`,
                      objectPath: message.imageUrl,
                      prompt: message.content || 'AI enhanced image',
                      tags: ['ai-generated']
                    })
                  });

                  if (!saveResponse.ok) {
                    throw new Error('Failed to save image');
                  }
                  
                  // Refresh the library to show the new saved image
                  queryClient.invalidateQueries({ queryKey: ['/api/library', 'default'] });
                  
                  // Show success message
                  toast({
                    title: "Success",
                    description: "Image saved to library",
                  });
                } catch (error) {
                  console.error('Error saving image:', error);
                  toast({
                    title: "Error",
                    description: "Failed to save image to library",
                    variant: "destructive",
                  });
                }
              }}
            />
          </div>
        ) : (
          <GalleryView />
        )}


        {/* Model Configuration Sidebar */}
        <ModelConfig
          isOpen={configOpen}
          onClose={() => setConfigOpen(false)}
        />
      </div>
    </div>
  );
}
