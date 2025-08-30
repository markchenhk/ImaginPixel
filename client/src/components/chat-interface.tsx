import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Bot, User, ImageIcon, Download, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Message, Conversation } from '@shared/schema';
import { UploadedImage } from '@/types';

interface ChatInterfaceProps {
  conversationId: string | null;
  onConversationCreate: (conversation: Conversation) => void;
  onImageProcessed: (originalUrl: string, processedUrl: string) => void;
  onSaveToLibrary?: (imageUrl: string, title: string) => void;
}

export default function ChatInterface({ 
  conversationId, 
  onConversationCreate,
  onImageProcessed,
  onSaveToLibrary
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
            queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
            queryClient.refetchQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
          } else if (job.status === 'processing') {
            pollCount++;
            // Adaptive polling: start fast, then slow down
            const delay = pollCount < 3 ? 1000 : pollCount < 10 ? 3000 : 5000;
            setTimeout(pollJob, delay);
          }
        }).catch((error) => {
          console.log('Polling error:', error);
          // Stop polling on error after a few retries
          if (pollCount < 5) {
            setTimeout(pollJob, 5000);
            pollCount++;
          } else {
            console.log('Stopped polling after 5 retries');
            // Force refresh messages anyway in case job completed but polling failed
            queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
            queryClient.refetchQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
          }
        });
      };
      
      setTimeout(pollJob, 500); // Start faster
      
      // Also schedule a safety refresh in case polling fails
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
        queryClient.refetchQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
      }, 15000); // Safety refresh after 15 seconds
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
    <div className="flex-1 flex justify-center bg-[#1e1e1e]">
      <div className="w-1/2 border-r border-[#2a2a2a] flex flex-col bg-[#1e1e1e]">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="chat-message animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="bg-gradient-to-br from-white/80 to-blue-50/60 dark:from-gray-800/90 dark:to-gray-900/60 rounded-2xl p-6 max-w-md border-2 border-blue-200/40 dark:border-blue-800/40 shadow-xl backdrop-blur-sm">
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">🎨 AI Image Studio</h3>
                    <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    Upload an image and describe your vision! I specialize in:
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      <span className="font-medium">🎨 Color enhancement & correction</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                      <span className="font-medium">🖼️ Style transfer & artistic effects</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span className="font-medium">✂️ Object removal & background editing</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div key={message.id} className="chat-message animate-in fade-in-0 slide-in-from-bottom-1 duration-300" style={{animationDelay: `${index * 50}ms`}}>
              <div className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                
                <div className={`rounded-2xl shadow-lg border transition-all hover:shadow-xl ${
                  message.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-500/20 max-w-lg' 
                    : 'bg-gradient-to-br from-secondary to-secondary/80 border-border/50 max-w-md'
                }`}>
                  {message.imageUrl && (
                    <div className={`mb-4 ${message.role === 'user' ? 'p-3 bg-white/10 rounded-xl border border-white/20' : ''}`}>
                      <div className="relative group">
                        <img 
                          src={message.imageUrl} 
                          alt={message.role === 'user' ? 'Uploaded image' : 'Generated image'} 
                          className="rounded-xl w-full max-w-sm mb-3 transition-transform hover:scale-[1.02] shadow-lg border border-white/20"
                          data-testid={`message-image-${message.id}`}
                        />
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 rounded-xl transition-colors" />
                        {message.role === 'user' && (
                          <div className="absolute top-2 left-2 bg-white/90 text-black text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                            📷 Your Image
                          </div>
                        )}
                      </div>
                      {message.role === 'assistant' && message.processingStatus === 'completed' && (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = message.imageUrl!;
                              link.download = `enhanced-image-${message.id}.jpg`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            data-testid={`download-image-${message.id}`}
                            className="text-xs bg-white/10 hover:bg-white/20 border-white/20 text-foreground shadow-sm transition-all"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                          <Button
                            variant="secondary" 
                            size="sm"
                            onClick={() => {
                              if (onSaveToLibrary && message.imageUrl) {
                                onSaveToLibrary(message.imageUrl, `Enhanced Image ${new Date().toLocaleDateString()}`);
                              }
                            }}
                            data-testid={`save-image-${message.id}`}
                            className="text-xs bg-white/10 hover:bg-white/20 border-white/20 text-foreground shadow-sm transition-all"
                          >
                            <Heart className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={`${
                    message.role === 'user' ? 'p-5' : 'p-5'
                  }`}>
                    {message.processingStatus === 'processing' && (
                      <div className="flex items-center gap-3 mb-4">
                        <div className="loading-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span className="font-medium text-blue-600 animate-pulse text-sm">Processing image...</span>
                      </div>
                    )}
                    
                    {message.role === 'user' && message.content && (
                      <div className="border-t border-white/20 pt-4 mt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                          <span className="text-xs font-medium text-white/80 uppercase tracking-wide">Your Request</span>
                        </div>
                        <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{message.content}</p>
                      </div>
                    )}
                    
                    {message.role === 'assistant' && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    )}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                    <User className="w-5 h-5 text-white" />
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
        {/* Image Upload Zone */}

        {/* Uploaded Image Preview */}
        {uploadedImage && (
          <div className="mb-4 p-4 bg-gradient-to-br from-blue-50/80 to-blue-100/60 dark:from-blue-950/30 dark:to-blue-900/20 rounded-2xl border border-blue-200/40 dark:border-blue-800/40 shadow-lg backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="relative group">
                <img 
                  src={uploadedImage.imageUrl} 
                  alt="Upload preview" 
                  className="w-16 h-16 rounded-xl object-cover shadow-md border-2 border-white/50 group-hover:scale-105 transition-transform"
                />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                  <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 truncate">{uploadedImage.originalName}</p>
                </div>
                <p className="text-xs text-blue-700/70 dark:text-blue-300/70 font-medium">
                  💾 {(uploadedImage.size / 1024 / 1024).toFixed(2)} MB • ✅ Ready to enhance
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                  <span className="font-medium">Upload complete - describe your vision below</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadedImage(null)}
                data-testid="remove-image-button"
                className="bg-white/70 hover:bg-white/90 border-blue-200/60 text-blue-700 shadow-sm hover:shadow-md transition-all"
              >
                ✕ Remove
              </Button>
            </div>
          </div>
        )}

        {/* Context Indicator */}
        {!uploadedImage && messages.length > 0 && (
          <div className="mb-4 p-4 bg-gradient-to-r from-amber-50/80 to-yellow-50/60 dark:from-amber-950/30 dark:to-yellow-900/20 rounded-2xl border border-amber-200/40 dark:border-amber-800/40 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold flex items-center gap-2">
                  🔄 Using conversation context
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-300/70">
                  Working with the latest image from this conversation
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              placeholder={uploadedImage 
                ? "✨ Describe your vision: How would you like me to enhance your image?"
                : messages.length > 0 
                  ? "🎨 Continue the magic: What changes would you like to make?"
                  : "📷 Drop an image here or paste from clipboard to start creating!"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={`resize-none pr-12 transition-all bg-white/50 dark:bg-gray-900/50 border-2 ${
                isDragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg' : 'border-gray-200 dark:border-gray-700'
              } focus:border-blue-500 focus:shadow-lg rounded-xl`}
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
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-800/70 px-2 py-1 rounded-full">
              {input.length}/500
            </div>
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || processImageMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all px-6 py-3 rounded-xl"
            data-testid="send-message-button"
          >
            {processImageMutation.isPending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-sm">Creating...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span className="text-sm font-medium">✨ Enhance</span>
              </div>
            )}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
            ⚡ Quick Actions
            <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent dark:from-gray-600"></div>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { action: 'Enhance colors', icon: '🎨', desc: 'Vibrant colors' },
              { action: 'Remove background', icon: '✂️', desc: 'Clean cutout' },
              { action: 'Style transfer', icon: '🖼️', desc: 'Artistic style' },
              { action: 'Upscale quality', icon: '🔍', desc: 'Higher resolution' }
            ].map(({ action, icon, desc }) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                className="text-xs bg-white/60 dark:bg-gray-800/60 hover:bg-white/90 dark:hover:bg-gray-700/80 border-gray-200/60 dark:border-gray-600/60 text-gray-700 dark:text-gray-300 shadow-sm hover:shadow-md transition-all h-auto p-2 flex flex-col gap-1 rounded-xl"
                onClick={() => handleQuickAction(action)}
                data-testid={`quick-action-${action.toLowerCase().replace(' ', '-')}`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <span>{icon}</span>
                  <span>{action}</span>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">{desc}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
