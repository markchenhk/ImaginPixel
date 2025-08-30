import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Settings, Wand2, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ChatInterface from '@/components/chat-interface';
import ModelConfig from '@/components/model-config';
import UserLibraryPanel from '@/components/user-library-panel';
import { LeftSidebar } from '@/components/left-sidebar';
import { getModelDisplayName } from '@/lib/openrouter';
import type { Conversation, ModelConfiguration } from '@shared/schema';

export default function ImageEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  // Fetch model configuration for header display
  const { data: modelConfig } = useQuery<ModelConfiguration>({
    queryKey: ['/api/model-config'],
  });

  const handleConversationCreate = (conversation: Conversation) => {
    setCurrentConversation(conversation);
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
          {/* Model Status Indicator */}
          <div className="flex items-center gap-2 text-sm text-[#e0e0e0]">
            <div className={`w-2 h-2 rounded-full ${
              modelConfig?.apiKeyConfigured === 'true' ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
            <span data-testid="selected-model">
              {getModelDisplayName(modelConfig?.selectedModel || 'openai/gpt-4o')}
            </span>
          </div>
          
          {/* Settings Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfigOpen(true)}
            data-testid="settings-button"
            className="text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar onSettingsClick={() => setConfigOpen(true)} />
        
        {/* Chat Interface */}
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
                  userId: 'default',
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

        {/* User Library Panel */}
        <UserLibraryPanel
          processedImageUrl={processedImageUrl}
        />

        {/* Model Configuration Sidebar */}
        <ModelConfig
          isOpen={configOpen}
          onClose={() => setConfigOpen(false)}
        />
      </div>
    </div>
  );
}
