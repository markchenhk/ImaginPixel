import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Bot, User, ImageIcon, Download, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Message, Conversation, PromptTemplate } from '@shared/schema';
import { UploadedImage } from '@/types';
import { ImagePopup } from './image-popup';
import { PromptTemplateButtons } from './prompt-template-buttons';

interface ChatInterfaceProps {
  conversationId: string | null;
  onConversationCreate: (conversation: Conversation) => void;
  onImageProcessed: (originalUrl: string, processedUrl: string) => void;
  onSaveToLibrary?: (imageUrl: string, title: string) => void;
  onImageSelected?: (imageUrl: string) => void; // New prop for selecting images for editing
}

export default function ChatInterface({ 
  conversationId, 
  onConversationCreate,
  onImageProcessed,
  onSaveToLibrary,
  onImageSelected
}: ChatInterfaceProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [popupImageUrl, setPopupImageUrl] = useState<string | null>(null);
  const [popupMessageId, setPopupMessageId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
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
        // Bypass QueryClient cache and fetch directly to avoid stale data
        fetch(`/api/processing-jobs/${result.aiMessage.id}`, {
          credentials: 'include'
        }).then(res => res.json()).then((job: any) => {
          console.log('Polling job:', result.aiMessage.id, 'Status:', job?.status);
          console.log('Full job data:', job);
          if (job.status === 'completed') {
            if (job.processedImageUrl) {
              onImageProcessed(job.originalImageUrl, job.processedImageUrl);
            }
            // Force refresh messages to show updated AI response
            queryClient.invalidateQueries({ 
              queryKey: ['/api/conversations', conversationId, 'messages']
            });
          } else if (job.status === 'failed') {
            console.error('Job failed:', job.error);
            // Refresh messages to show failure status
            queryClient.invalidateQueries({ 
              queryKey: ['/api/conversations', conversationId, 'messages']
            });
          } else if (job.status === 'processing' && pollCount < 60) {
            pollCount++;
            setTimeout(pollJob, 2000); // Poll every 2 seconds
          }
        }).catch(err => {
          console.error('Polling error:', err);
          if (pollCount < 60) {
            pollCount++;
            setTimeout(pollJob, 2000);
          }
        });
      };
      
      // Start polling after a short delay
      setTimeout(pollJob, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Processing failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleImageUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    uploadImageMutation.mutate(file);
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !selectedTemplateId) return;
    
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
      // Use template content if a template is selected, otherwise use input
      let messageContent = input;
      if (selectedTemplateId && !input.trim()) {
        // Find the selected template and use its content
        try {
          const response = await fetch('/api/prompt-templates');
          const templates = await response.json();
          const selectedTemplate = templates.find((t: PromptTemplate) => t.id === selectedTemplateId);
          if (selectedTemplate) {
            messageContent = selectedTemplate.template;
          }
        } catch (error) {
          console.error('Failed to fetch template:', error);
        }
      }

      // Send with uploaded image (if any) or use conversation context
      processImageMutation.mutate({
        conversationId: currentConversationId,
        imageUrl: uploadedImage?.imageUrl, // Optional - backend will use conversation context if not provided
        prompt: messageContent,
      });
      
      setInput('');
      setUploadedImage(null);
      setSelectedTemplateId(null); // Clear template selection after sending
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  const handleTemplateSelect = (template: PromptTemplate) => {
    // Set the selected template for highlighting
    setSelectedTemplateId(template.id);
    // Don't show the prompt content - just keep it selected
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
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="chat-message animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 border border-[#ffd700] bg-[#ffd700]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-[#ffd700]" />
                </div>
                <div className="bg-[#2a2a2a] rounded-2xl p-5 max-w-md border border-[#3a3a3a]">
                  <p className="text-sm leading-relaxed text-[#e0e0e0]">
                    Welcome! Upload an image and tell me how you'd like to enhance or modify it. 
                    I can help with <span className="font-medium text-[#aaaaaa]">color correction</span>, <span className="font-medium text-[#aaaaaa]">style transfer</span>, <span className="font-medium text-[#aaaaaa]">object removal</span>, and much more.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div key={message.id} className="chat-message animate-in fade-in-0 slide-in-from-bottom-1 duration-300" style={{animationDelay: `${index * 50}ms`}}>
              <div className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="w-10 h-10 border border-[#ffd700] bg-[#ffd700]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-[#ffd700]" />
                  </div>
                )}
                
                <div className={`rounded-2xl p-4 border transition-all ${
                  message.role === 'user' 
                    ? 'bg-[#2a2a2a] border-[#3a3a3a] max-w-md' 
                    : 'bg-gradient-to-br from-secondary to-secondary/80 border-border/50 max-w-md'
                }`}>
                  {message.imageUrl && (
                    <div className="mb-3">
                      <div className="relative group">
                        <img 
                          src={message.imageUrl} 
                          alt={message.role === 'user' ? 'Uploaded image' : 'Generated image'} 
                          className={`rounded-xl transition-transform hover:scale-[1.02] shadow-lg border border-[#3a3a3a] ${
                            message.role === 'user' ? 'w-full max-w-xs mb-2' : 'w-full max-w-sm mb-3'
                          }`}
                          data-testid={`message-image-${message.id}`}
                        />
                        <div 
                          className={`absolute inset-0 bg-black/0 hover:bg-black/10 rounded-xl transition-colors ${
                            message.role === 'assistant' && message.processingStatus === 'completed' ? 'cursor-pointer' : ''
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (message.role === 'assistant' && message.processingStatus === 'completed') {
                              setPopupImageUrl(message.imageUrl!);
                              setPopupMessageId(message.id);
                            }
                          }}
                        />
                        {message.role === 'user' && (
                          <div className="absolute top-2 left-2 border border-[#666666] bg-black/60 text-[#e0e0e0] text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                            📷 Your Image
                          </div>
                        )}
                        {message.role === 'assistant' && message.processingStatus === 'completed' && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl bg-black/20">
                            <div className="flex flex-col gap-2 items-center">
                              <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">Click to view larger</span>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (onImageSelected && message.imageUrl) {
                                    onImageSelected(message.imageUrl);
                                    toast({
                                      title: "Image loaded",
                                      description: "Generated image loaded into Product Editor",
                                    });
                                  }
                                }}
                                className="border border-[#ffd700] bg-[#ffd700]/10 hover:bg-[#ffd700]/20 text-[#ffd700] px-3 py-1 text-sm font-medium rounded-full"
                                data-testid={`button-edit-image-${message.id}`}
                              >
                                Edit Image
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {message.role === 'user' && (
                    <div className={`${message.imageUrl ? '' : 'p-4'}`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#e0e0e0]">{message.content}</p>
                    </div>
                  )}
                  
                  {message.role === 'assistant' && (
                    <div className={`${message.imageUrl ? '' : 'p-4'}`}>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#e0e0e0]">{message.content}</p>
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-10 h-10 bg-[#3a3a3a] rounded-full flex items-center justify-center flex-shrink-0 border border-[#4a4a4a]">
                    <User className="w-5 h-5 text-[#e0e0e0]" />
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Chat Input */}
      <div className="border-t border-[#2a2a2a] p-6 bg-[#1a1a1a]">
        {/* Uploaded Image Preview */}
        {uploadedImage && (
          <div className="mb-4 p-4 bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] flex items-center gap-4 shadow-sm">
            <div className="relative">
              <img 
                src={uploadedImage.imageUrl} 
                alt="Upload preview" 
                className="w-12 h-12 rounded-lg object-cover border border-[#3a3a3a]"
              />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#ffd700] rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-black rounded-full"></div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#e0e0e0]">{uploadedImage.originalName}</p>
              <p className="text-xs text-[#888888]">
                {(uploadedImage.size / 1024 / 1024).toFixed(2)} MB • Ready to process
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadedImage(null)}
              data-testid="remove-image-button"
              className="bg-[#3a3a3a] hover:bg-[#4a4a4a] border-[#4a4a4a] text-[#e0e0e0]"
            >
              Remove
            </Button>
          </div>
        )}

        {/* Context Indicator */}
        {!uploadedImage && messages.length > 0 && (
          <div className="mb-4 p-3 bg-[#2a2a2a] rounded-xl border border-[#3a3a3a]">
            <p className="text-sm text-[#ffd700] flex items-center gap-2 font-medium">
              <ImageIcon className="w-4 h-4" />
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
                isDragOver ? 'border-[#ffd700] border-2 bg-[#ffd700]/5' : 'border-[#3a3a3a]'
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
            <div className="absolute bottom-2 right-2 text-xs text-[#888888]">
              {input.length}/500
            </div>
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={(!input.trim() && !selectedTemplateId) || processImageMutation.isPending}
            className="border border-[#ffd700] bg-[#ffd700]/10 hover:bg-[#ffd700]/20 text-[#ffd700] font-medium"
            data-testid="send-message-button"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Prompt Template Actions */}
        <PromptTemplateButtons 
          onTemplateSelect={handleTemplateSelect} 
          selectedTemplateId={selectedTemplateId || undefined}
        />
      </div>

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