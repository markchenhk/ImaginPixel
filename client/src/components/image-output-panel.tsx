import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Download, Save, RotateCcw, Maximize2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Message } from '@shared/schema';
import { ImagePopup } from './image-popup';

interface ImageOutputPanelProps {
  conversationId: string;
  onSaveToLibrary?: (messageId: string) => void;
}

export function ImageOutputPanel({ conversationId, onSaveToLibrary }: ImageOutputPanelProps) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [popupImageUrl, setPopupImageUrl] = useState<string | null>(null);
  const [popupMessageId, setPopupMessageId] = useState<string | null>(null);

  // Fetch messages for current conversation
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    enabled: !!conversationId,
    staleTime: 0,
    refetchInterval: 2000, // Refresh every 2 seconds to check for updates
  });

  // Filter for assistant messages with images
  const generatedImages = messages.filter(msg => 
    msg.role === 'assistant' && msg.imageUrl
  );

  // Auto-select the latest completed image
  useEffect(() => {
    const latestCompleted = generatedImages
      .filter(msg => msg.processingStatus === 'completed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    if (latestCompleted && selectedImageUrl !== latestCompleted.imageUrl) {
      setSelectedImageUrl(latestCompleted.imageUrl!);
      setSelectedMessageId(latestCompleted.id);
    }
  }, [generatedImages, selectedImageUrl]);

  const getStatusInfo = (status: string | undefined) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: 'text-yellow-400', text: 'Queued' };
      case 'processing':
        return { icon: Clock, color: 'text-blue-400', text: 'Processing...' };
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-400', text: 'Complete' };
      case 'failed':
        return { icon: AlertCircle, color: 'text-red-400', text: 'Failed' };
      default:
        return { icon: Clock, color: 'text-gray-400', text: 'Unknown' };
    }
  };

  const handleDownload = (imageUrl: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename || `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImageClick = (imageUrl: string, messageId: string) => {
    setPopupImageUrl(imageUrl);
    setPopupMessageId(messageId);
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd700] mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[#3a3a3a]">
        <h2 className="text-xl font-semibold text-white mb-2">Generated Images</h2>
        <p className="text-gray-400 text-sm">
          {generatedImages.length > 0 
            ? `${generatedImages.length} image${generatedImages.length !== 1 ? 's' : ''} generated`
            : 'Upload an image and enter a prompt to get started'
          }
        </p>
      </div>

      {generatedImages.length === 0 ? (
        // Empty state
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-[#2a2a2a] rounded-full flex items-center justify-center mx-auto mb-6">
              <Maximize2 className="h-12 w-12 text-[#ffd700]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">No images yet</h3>
            <p className="text-gray-400 leading-relaxed">
              Upload an image on the left and describe how you'd like to enhance or modify it. 
              Your generated images will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex">
          {/* Main Image Display */}
          <div className="flex-1 p-6">
            {selectedImageUrl ? (
              <div className="h-full flex flex-col">
                <div className="flex-1 flex items-center justify-center bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] overflow-hidden">
                  <img
                    src={selectedImageUrl}
                    alt="Generated image"
                    className="max-w-full max-h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => selectedMessageId && handleImageClick(selectedImageUrl, selectedMessageId)}
                    data-testid="main-generated-image"
                  />
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 mt-4">
                  <Button
                    onClick={() => handleDownload(selectedImageUrl)}
                    className="flex-1 bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-medium"
                    data-testid="download-button"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  {onSaveToLibrary && selectedMessageId && (
                    <Button
                      onClick={() => onSaveToLibrary(selectedMessageId)}
                      variant="outline"
                      className="border-[#3a3a3a] text-white hover:bg-[#3a3a3a]"
                      data-testid="save-library-button"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save to Library
                    </Button>
                  )}
                  <Button
                    onClick={() => selectedMessageId && handleImageClick(selectedImageUrl, selectedMessageId)}
                    variant="outline"
                    className="border-[#3a3a3a] text-white hover:bg-[#3a3a3a]"
                    data-testid="fullscreen-button"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-[#2a2a2a] rounded-xl border border-[#3a3a3a]">
                <p className="text-gray-400">Select an image to view</p>
              </div>
            )}
          </div>

          {/* Image History Sidebar */}
          <div className="w-80 border-l border-[#3a3a3a] p-4 bg-[#2a2a2a]">
            <h3 className="text-white font-medium mb-4">Recent Images</h3>
            <div className="space-y-3 max-h-full overflow-y-auto">
              {generatedImages
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((message) => {
                  const statusInfo = getStatusInfo(message.processingStatus || undefined);
                  const isSelected = selectedImageUrl === message.imageUrl;
                  
                  return (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-[#ffd700] bg-[#ffd700]/10' 
                          : 'border-[#3a3a3a] hover:border-[#ffd700]/50 hover:bg-[#3a3a3a]/50'
                      }`}
                      onClick={() => {
                        if (message.imageUrl && message.processingStatus === 'completed') {
                          setSelectedImageUrl(message.imageUrl);
                          setSelectedMessageId(message.id);
                        }
                      }}
                      data-testid={`history-image-${message.id}`}
                    >
                      {message.imageUrl && (
                        <div className="aspect-square bg-[#1a1a1a] rounded mb-2 overflow-hidden">
                          <img
                            src={message.imageUrl}
                            alt="Generated"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mb-1">
                        <statusInfo.icon className={`h-3 w-3 ${statusInfo.color}`} />
                        <span className={`text-xs ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {message.content}
                      </p>
                      
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Image Popup */}
      {popupImageUrl && popupMessageId && (
        <ImagePopup
          isOpen={!!popupImageUrl}
          onClose={() => {
            setPopupImageUrl(null);
            setPopupMessageId(null);
          }}
          imageUrl={popupImageUrl}
          messageId={popupMessageId}
          onSaveToLibrary={onSaveToLibrary}
        />
      )}
    </div>
  );
}