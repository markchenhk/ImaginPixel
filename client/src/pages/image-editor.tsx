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
  const [selectedImageForEditor, setSelectedImageForEditor] = useState<{ url: string; messageId: string } | null>(null);

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
        />
        
        {/* Chat Panel - Left Side */}
        <div className={`transition-all duration-300 ${
          selectedImageForEditor ? 'w-1/2' : 'flex-1'
        } bg-red-500 border-2 border-yellow-400`}>
          {currentView === 'chat' ? (
            <ChatInterface
              conversationId={currentConversation?.id || null}
              onConversationCreate={handleConversationCreate}
              onImageProcessed={handleImageProcessed}
              onImageClick={(imageUrl, messageId) => {
                setSelectedImageForEditor({ url: imageUrl, messageId });
              }}
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
          ) : (
            <GalleryView />
          )}
        </div>
        
        {/* Advanced Image Editor Panel - Right Side */}
        {selectedImageForEditor && (
          <div className="w-1/2 border-l border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
              <h2 className="text-lg font-semibold text-white">Advanced Editor</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImageForEditor(null)}
                className="text-[#e0e0e0] hover:bg-[#2a2a2a]"
                data-testid="close-editor-panel"
              >
                ✕
              </Button>
            </div>
            <div className="flex-1 p-4">
              <div className="w-full h-64 bg-[#2a2a2a] rounded-lg mb-4 overflow-hidden">
                <img
                  src={selectedImageForEditor.url}
                  alt="Selected for editing"
                  className="w-full h-full object-contain"
                  data-testid="editor-selected-image"
                />
              </div>
              
              {/* Editing Tools */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-[#2a2a2a] border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    data-testid="enhance-colors-btn"
                  >
                    Enhance Colors
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-[#2a2a2a] border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    data-testid="remove-background-btn"
                  >
                    Remove Background
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-[#2a2a2a] border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    data-testid="style-transfer-btn"
                  >
                    Style Transfer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-[#2a2a2a] border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    data-testid="upscale-quality-btn"
                  >
                    Upscale Quality
                  </Button>
                </div>
                
                <div className="border-t border-[#2a2a2a] pt-4">
                  <h3 className="text-sm font-medium text-[#e0e0e0] mb-2">Quick Actions</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-[#ffd700] border-[#ffd700] text-black hover:bg-[#ffed4e]"
                      data-testid="download-image-btn"
                    >
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-[#2a2a2a] border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                      data-testid="save-to-library-btn"
                    >
                      Save to Library
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
