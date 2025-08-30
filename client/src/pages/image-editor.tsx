import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ChatInterface from '@/components/chat-interface';
import ModelConfig from '@/components/model-config';
import UserLibraryPanel from '@/components/user-library-panel';
import { getModelDisplayName } from '@/lib/openrouter';
import type { Conversation, ModelConfiguration } from '@shared/schema';

export default function ImageEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-5 flex items-center justify-between bg-gradient-to-r from-background to-muted/20 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Image Editor
            </h1>
            <p className="text-sm text-muted-foreground">Powered by LLM Models</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Model Status Indicator */}
          <div className="flex items-center gap-3 bg-card/50 rounded-full px-4 py-2 border border-border/30">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              modelConfig?.apiKeyConfigured === 'true' ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
            <span className="text-sm font-medium text-foreground" data-testid="selected-model">
              {getModelDisplayName(modelConfig?.selectedModel || 'openai/gpt-4o')}
            </span>
          </div>
          
          {/* Settings Button */}
          <Button
            variant="outline"
            size="default"
            onClick={() => setConfigOpen(true)}
            data-testid="settings-button"
            className="bg-card/50 hover:bg-card border-border/30 shadow-sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Centered Chat Interface */}
        <div className="flex-1 flex justify-center bg-slate-50/30 dark:bg-slate-800/30">
          <div className="w-full max-w-4xl">
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
          </div>
        </div>

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
