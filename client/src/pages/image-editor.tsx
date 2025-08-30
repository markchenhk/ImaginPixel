import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChatInterface from '@/components/chat-interface';
import ImagePreview from '@/components/image-preview';
import ModelConfig from '@/components/model-config';
import { getModelDisplayName } from '@/lib/openrouter';
import type { Conversation } from '@shared/schema';

export default function ImageEditor() {
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  // Fetch model configuration for header display
  const { data: modelConfig } = useQuery({
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
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Image Editor</h1>
            <p className="text-xs text-muted-foreground">Powered by LLM Models</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Model Status Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              modelConfig?.apiKeyConfigured === 'true' ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
            <span className="text-muted-foreground" data-testid="selected-model">
              {getModelDisplayName(modelConfig?.selectedModel || 'openai/gpt-4o')}
            </span>
          </div>
          
          {/* Settings Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfigOpen(true)}
            data-testid="settings-button"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Interface */}
        <ChatInterface
          conversationId={currentConversation?.id || null}
          onConversationCreate={handleConversationCreate}
          onImageProcessed={handleImageProcessed}
        />

        {/* Image Preview */}
        <ImagePreview
          originalImageUrl={originalImageUrl}
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
