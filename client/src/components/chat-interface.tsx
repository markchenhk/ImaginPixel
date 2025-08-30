import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Bot, User, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import UploadZone from './upload-zone';
import type { Message, Conversation } from '@shared/schema';
import { UploadedImage } from '@/types';

interface ChatInterfaceProps {
  conversationId: string | null;
  onConversationCreate: (conversation: Conversation) => void;
  onImageProcessed: (originalUrl: string, processedUrl: string) => void;
}

export default function ChatInterface({ 
  conversationId, 
  onConversationCreate,
  onImageProcessed 
}: ChatInterfaceProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages for current conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    enabled: !!conversationId,
    staleTime: 0, // Always fetch fresh data
    refetchInterval: (data) => {
      // Keep polling if any message is still processing
      const hasProcessing = Array.isArray(data) && data.some(msg => msg.processingStatus === 'processing');
      return hasProcessing ? 2000 : false;
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest('POST', '/api/conversations', { title });
      return response.json();
    },
    onSuccess: (conversation: Conversation) => {
      onConversationCreate(conversation);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      return response.json();
    },
    onSuccess: (uploadResult: UploadedImage) => {
      setUploadedImage(uploadResult);
      setIsUploading(false);
      toast({
        title: 'Image uploaded successfully',
        description: 'You can now describe how you want to enhance it.',
      });
    },
    onError: (error: Error) => {
      setIsUploading(false);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Process image mutation
  const processImageMutation = useMutation({
    mutationFn: async ({ conversationId, imageUrl, prompt }: { 
      conversationId: string; 
      imageUrl?: string; 
      prompt: string; 
    }) => {
      const response = await apiRequest('POST', '/api/process-image', {
        conversationId,
        imageUrl,
        prompt,
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
      
      // Start optimized polling for processing job completion
      let pollCount = 0;
      const pollJob = () => {
        queryClient.fetchQuery({
          queryKey: ['/api/processing-jobs', result.aiMessage.id],
        }).then((job: any) => {
          if (job.status === 'completed') {
            if (job.processedImageUrl) {
              onImageProcessed(job.originalImageUrl, job.processedImageUrl);
            }
            // Force refresh messages to show updated AI response
            queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
            queryClient.refetchQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
          } else if (job.status === 'processing') {
            pollCount++;
            // Adaptive polling: start fast, then slow down
            const delay = pollCount < 3 ? 1000 : pollCount < 10 ? 3000 : 5000;
            setTimeout(pollJob, delay);
          }
        }).catch(() => {
          // Stop polling on error after a few retries
          if (pollCount < 5) {
            setTimeout(pollJob, 5000);
            pollCount++;
          }
        });
      };
      
      setTimeout(pollJob, 500); // Start faster
    },
    onError: (error: Error) => {
      toast({
        title: 'Processing failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleImageUpload = (file: File) => {
    setIsUploading(true);
    uploadImageMutation.mutate(file);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    let currentConversationId = conversationId;
    
    // Create conversation if it doesn't exist
    if (!currentConversationId) {
      const title = input.length > 50 ? `${input.substring(0, 50)}...` : input;
      currentConversationId = await new Promise((resolve) => {
        createConversationMutation.mutate(title, {
          onSuccess: (conversation) => resolve(conversation.id),
        });
      });
    }

    if (currentConversationId) {
      // Send with uploaded image (if any) or use conversation context
      processImageMutation.mutate({
        conversationId: currentConversationId,
        imageUrl: uploadedImage?.imageUrl, // Optional - backend will use conversation context if not provided
        prompt: input,
      });
      
      setInput('');
      setUploadedImage(null);
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  // Handle image paste from clipboard
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      e.preventDefault(); // Prevent default paste behavior
      
      const file = imageItem.getAsFile();
      if (file) {
        // Show immediate feedback
        toast({
          title: 'Image pasted!',
          description: 'Uploading your image...',
        });
        
        // Use existing upload flow
        handleImageUpload(file);
      }
    }
  };

  // Handle drag over for textarea
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  // Handle drag leave for textarea  
  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Handle drop on textarea
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      toast({
        title: 'Image dropped!',
        description: 'Uploading your image...',
      });
      
      handleImageUpload(imageFile);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-1/2 border-r border-border flex flex-col">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="chat-message">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-secondary rounded-lg p-4 max-w-sm">
                  <p className="text-sm">
                    Welcome! Upload an image and tell me how you'd like to enhance or modify it. 
                    I can help with color correction, style transfer, object removal, and much more.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div key={message.id} className="chat-message">
              <div className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`rounded-lg p-4 max-w-sm ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-secondary'
                }`}>
                  {message.imageUrl && (
                    <div className="mb-3">
                      <img 
                        src={message.imageUrl} 
                        alt="Uploaded image" 
                        className="rounded-lg w-full max-w-xs"
                        data-testid={`message-image-${message.id}`}
                      />
                    </div>
                  )}
                  
                  <div className="text-sm">
                    {message.processingStatus === 'processing' && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="loading-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span className="font-medium">Processing image...</span>
                      </div>
                    )}
                    
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Chat Input */}
      <div className="border-t border-border p-4">
        {/* Image Upload Zone */}
        {!uploadedImage && (
          <UploadZone 
            onImageUpload={handleImageUpload}
            isUploading={isUploading}
            className="mb-4"
          />
        )}

        {/* Uploaded Image Preview */}
        {uploadedImage && (
          <div className="mb-4 p-3 bg-secondary rounded-lg flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{uploadedImage.originalName}</p>
              <p className="text-xs text-muted-foreground">
                {(uploadedImage.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUploadedImage(null)}
              data-testid="remove-image-button"
            >
              Remove
            </Button>
          </div>
        )}

        {/* Context Indicator */}
        {!uploadedImage && messages.length > 0 && (
          <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              Using latest image from conversation context
            </p>
          </div>
        )}

        {/* Message Input */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              placeholder={uploadedImage 
                ? "Describe how you want to enhance your image... (You can also paste or drag images directly here)"
                : messages.length > 0 
                  ? "Continue editing the latest image from this conversation... (Or paste/drag a new image)"
                  : "Upload an image to get started, or paste/drag images directly here"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={`resize-none pr-12 transition-all ${
                isDragOver ? 'border-blue-500 border-2 bg-blue-50 dark:bg-blue-950/20' : ''
              }`}
              rows={3}
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              onPaste={handlePaste}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="message-input"
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {input.length}/500
            </div>
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || processImageMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="send-message-button"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-3">
          {[
            'Enhance colors',
            'Remove background', 
            'Style transfer',
            'Upscale quality'
          ].map((action) => (
            <Button
              key={action}
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={() => handleQuickAction(action)}
              data-testid={`quick-action-${action.toLowerCase().replace(' ', '-')}`}
            >
              {action}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
