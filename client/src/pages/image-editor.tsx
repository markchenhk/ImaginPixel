import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Settings, Wand2, Home, ArrowLeft, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import ChatInterface from '@/components/chat-interface';
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
          onSettingsClick={() => setConfigOpen(true)}
          onNewChatClick={handleNewChat}
          onConversationSelect={handleConversationSelect}
          onGalleryClick={handleGalleryClick}
          currentConversationId={currentConversation?.id || null}
          currentView={currentView}
        />
        
        {/* Main Content Area with Two Columns */}
        {currentView === 'chat' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Chat Column (Left) - 50% width */}
            <div className="w-1/2 h-full">
              <ChatInterface
                conversationId={currentConversation?.id || null}
                onConversationCreate={handleConversationCreate}
                onImageProcessed={handleImageProcessed}
                onSaveToLibrary={async (imageUrl, title) => {
                  try {
                    const response = await fetch('/api/library/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: user?.id || '',
                        title,
                        objectPath: imageUrl,
                        prompt: 'AI enhanced image',
                        tags: ['ai-generated']
                      })
                    });

                    if (!response.ok) {
                      throw new Error('Failed to save image');
                    }

                    // Update the processed image URL for the library panel
                    setProcessedImageUrl(imageUrl);
                    
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
            
            {/* Preview Panel (Right) - 50% width */}
            <div className="w-1/2 h-full border-l border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
              <div className="p-4 border-b border-[#2a2a2a]">
                <h2 className="text-lg font-semibold text-white mb-2">Preview Panel</h2>
                <p className="text-sm text-[#888888]">
                  Original and processed images will appear here
                </p>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto">
                {originalImageUrl || processedImageUrl ? (
                  <div className="space-y-4">
                    {originalImageUrl && (
                      <div>
                        <h3 className="text-sm font-medium text-[#e0e0e0] mb-2">Original</h3>
                        <img 
                          src={originalImageUrl} 
                          alt="Original" 
                          className="w-full rounded-lg border border-[#3a3a3a] shadow-lg"
                        />
                      </div>
                    )}
                    
                    {processedImageUrl && (
                      <div>
                        <h3 className="text-sm font-medium text-[#e0e0e0] mb-2">Processed</h3>
                        <img 
                          src={processedImageUrl} 
                          alt="Processed" 
                          className="w-full rounded-lg border border-[#3a3a3a] shadow-lg"
                        />
                      </div>
                    )}
                    
                    {originalImageUrl && processedImageUrl && (
                      <div className="pt-4 border-t border-[#2a2a2a]">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#2a2a2a]"
                          onClick={() => {
                            // Reset the comparison
                            setOriginalImageUrl(null);
                            setProcessedImageUrl(null);
                          }}
                        >
                          Clear Comparison
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-[#2a2a2a] rounded-lg flex items-center justify-center mb-4">
                      <Wand2 className="w-8 h-8 text-[#888888]" />
                    </div>
                    <p className="text-sm text-[#888888] mb-2">No images to preview</p>
                    <p className="text-xs text-[#666666]">
                      Upload and process an image to see before/after comparison
                    </p>
                  </div>
                )}
              </div>
            </div>
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
