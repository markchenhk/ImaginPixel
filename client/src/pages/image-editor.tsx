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
import { EnhancedPromptEngineering } from '@/components/enhanced-prompt-engineering';
import UserLibraryPanel from '@/components/user-library-panel';
import { LeftSidebar } from '@/components/left-sidebar';
import { GalleryView } from '@/components/gallery-view';
import ImageEditorPanel from '@/components/image-editor-panel';
import { ResizablePanels } from '@/components/resizable-panels';
import { getModelDisplayName, getActiveModel } from '@/lib/openrouter';
import type { Conversation, ModelConfiguration } from '@shared/schema';

export default function ImageEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [promptEngineeringOpen, setPromptEngineeringOpen] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<'image-enhancement' | 'image-to-video'>('image-enhancement');

  // Fetch model configuration for header display (admin only)
  const { data: modelConfig } = useQuery<ModelConfiguration>({
    queryKey: ['/api/model-config'],
    enabled: isAdmin, // Only fetch if user is admin
    staleTime: 0, // Always check for fresh data
    gcTime: 0, // Don't cache for long
  });

  const handleConversationCreate = (conversation: Conversation) => {
    setCurrentConversation(conversation);
  };

  const handleFunctionSelect = (functionKey: 'image-enhancement' | 'image-to-video') => {
    setSelectedFunction(functionKey);
    // Reset current conversation when switching functions
    setCurrentConversation(null);
  };


  const handleImageProcessed = (originalUrl: string, processedUrl: string) => {
    setProcessedImageUrl(processedUrl);
  };

  const handleImageSelected = (imageUrl: string) => {
    setProcessedImageUrl(imageUrl);
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
            data-testid="home-button"
          >
            <Home className="w-4 h-4" />
          </Button>
          
          <div className="h-6 w-px bg-[#2a2a2a]" />
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#ffd700] bg-[#ffd700]/10 rounded-lg flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-[#ffd700]" />
            </div>
            <div>
              <h1 className="font-semibold text-white">
                {selectedFunction === 'image-enhancement' ? 'Image Enhancement' : selectedFunction === 'image-to-video' ? 'Image to Video' : 'AI Processing'}
              </h1>
              <p className="text-xs text-[#888888]">
                {selectedFunction === 'image-enhancement' 
                  ? 'Professional product image enhancement'
                  : selectedFunction === 'image-to-video'
                  ? 'Convert images to promotional videos'
                  : 'AI-powered image processing'
                }
              </p>
            </div>
          </div>

          {/* Model Display - Show current active model */}
          {isAdmin && modelConfig && (
            <div className="flex items-center gap-2">
              <div className="h-6 w-px bg-[#2a2a2a]" />
              <Badge variant="outline" className="border-[#3a3a3a] text-[#e0e0e0] bg-[#2a2a2a]">
                {getModelDisplayName(getActiveModel(modelConfig))}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-[#888888]">
            Welcome, {user?.firstName || user?.username}
          </div>
          
          <div className="h-6 w-px bg-[#2a2a2a] mx-2" />


          {/* Admin-Only Controls */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPromptEngineeringOpen(true)}
                data-testid="admin-prompt-templates-button"
                className="text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white"
                title="Manage Prompt Templates (Admin)"
              >
                <Wand2 className="w-4 h-4 mr-1" />
                <span className="text-xs">Templates</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfigOpen(true)}
                data-testid="settings-button"
                className="text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white"
                title="Model Configuration"
              >
                <Settings className="w-4 h-4" />
              </Button>
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
          selectedFunction={selectedFunction}
          onFunctionSelect={handleFunctionSelect}
        />
        
        {/* Main Content Area with Resizable Panels */}
        {selectedFunction === 'image-enhancement' ? (
          <ResizablePanels
            defaultLeftWidth={35}
            minLeftWidth={25}
            maxLeftWidth={75}
            leftPanel={
              <ChatInterface
                conversationId={currentConversation?.id || null}
                onConversationCreate={handleConversationCreate}
                onImageProcessed={handleImageProcessed}
                onImageSelected={handleImageSelected}
                onSaveToLibrary={async (imageUrl, title) => {
                  try {
                    const response = await fetch('/api/library/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
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
                    queryClient.invalidateQueries({ queryKey: ['/api/library', user?.id] });
                    
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
            }
            rightPanel={
              <ImageEditorPanel
                imageUrl={processedImageUrl}
                onSaveToLibrary={async (imageUrl, title) => {
                  try {
                    const response = await fetch('/api/library/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title,
                        objectPath: imageUrl,
                        prompt: 'AI enhanced and edited image',
                        tags: ['ai-generated', 'edited']
                      })
                    });

                    if (!response.ok) {
                      throw new Error('Failed to save image');
                    }

                    // Refresh the library to show the new saved image
                    queryClient.invalidateQueries({ queryKey: ['/api/library', user?.id] });
                    
                    // Show success message
                    toast({
                      title: "Success",
                      description: "Edited image saved to library",
                    });
                  } catch (error) {
                    console.error('Error saving image:', error);
                    toast({
                      title: "Error",
                      description: "Failed to save edited image to library",
                      variant: "destructive",
                    });
                  }
                }}
              />
            }
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#888888] bg-[#1a1a1a]">
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-dashed border-[#444444] rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Wand2 className="w-6 h-6 text-[#666666]" />
              </div>
              <div className="text-sm font-medium text-[#e0e0e0] mb-2">Image to Video Coming Soon</div>
              <div className="text-xs text-[#888888]">This feature will convert static product images</div>
              <div className="text-xs text-[#888888]">into engaging promotional videos</div>
              <div className="mt-4">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => handleFunctionSelect('image-enhancement')}
                  className="border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700]/10"
                >
                  Try Image Enhancement
                </Button>
              </div>
            </div>
          </div>
        )}


        {/* Model Configuration Sidebar */}
        <ModelConfig
          isOpen={configOpen}
          onClose={() => setConfigOpen(false)}
        />

        {/* Prompt Engineering Module */}
        <EnhancedPromptEngineering
          isOpen={promptEngineeringOpen}
          onClose={() => setPromptEngineeringOpen(false)}
          selectedFunction={selectedFunction}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}