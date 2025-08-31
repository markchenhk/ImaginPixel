import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { Upload, Send, Sparkles, Palette, Scissors, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InputSidebarProps {
  conversationId: string;
  onImageGenerated?: () => void;
}

export function InputSidebar({ conversationId, onImageGenerated }: InputSidebarProps) {
  const [prompt, setPrompt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ prompt, imageFile }: { prompt: string; imageFile?: File }) => {
      const formData = new FormData();
      formData.append('prompt', prompt);
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/conversations', conversationId, 'messages']
      });
      setPrompt('');
      onImageGenerated?.();
      toast({
        title: "Processing started",
        description: "Your image is being generated...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    sendMessageMutation.mutate({ prompt });
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, WebP)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      sendMessageMutation.mutate({ 
        prompt: prompt || "Analyze and enhance this image", 
        imageFile: file 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const quickActions = [
    { icon: Palette, label: "Enhance colors", prompt: "Enhance the colors and vibrancy of this image" },
    { icon: Scissors, label: "Remove background", prompt: "Remove the background from this image" },
    { icon: Sparkles, label: "Style transfer", prompt: "Apply an artistic style to this image" },
    { icon: Zap, label: "Upscale quality", prompt: "Improve the quality and resolution of this image" },
  ];

  return (
    <div className="w-80 bg-[#2a2a2a] border-r border-[#3a3a3a] flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-[#3a3a3a]">
        <h2 className="text-xl font-semibold text-white mb-2">AI Image Editor</h2>
        <p className="text-gray-400 text-sm">Upload an image and describe how you'd like to enhance or modify it.</p>
      </div>

      {/* Upload Area */}
      <div className="p-6 border-b border-[#3a3a3a]">
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
            ${isDragOver 
              ? 'border-[#ffd700] bg-[#ffd700]/10' 
              : 'border-[#3a3a3a] hover:border-[#ffd700]/50'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          data-testid="upload-area"
        >
          <Upload className="h-8 w-8 text-[#ffd700] mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Upload an image</p>
          <p className="text-gray-400 text-sm">Drag & drop or click to browse</p>
          <p className="text-gray-500 text-xs mt-2">JPEG, PNG, WebP (max 10MB)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-input"
        />
      </div>

      {/* Prompt Input */}
      <div className="p-6 border-b border-[#3a3a3a]">
        <label className="block text-white font-medium mb-3">Describe your changes</label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe how you'd like to modify or enhance the image..."
          className="min-h-[100px] bg-[#3a3a3a] border-[#4a4a4a] text-white placeholder-gray-400 focus:border-[#ffd700] focus:ring-[#ffd700]/20"
          data-testid="prompt-input"
        />
        <Button
          onClick={handleSubmit}
          disabled={!prompt.trim() || sendMessageMutation.isPending}
          className="w-full mt-3 bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-medium"
          data-testid="generate-button"
        >
          {sendMessageMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="p-6 flex-1">
        <label className="block text-white font-medium mb-3">Quick Actions</label>
        <div className="space-y-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              onClick={() => setPrompt(action.prompt)}
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-[#3a3a3a] text-sm"
              data-testid={`quick-action-${index}`}
            >
              <action.icon className="h-4 w-4 mr-3 text-[#ffd700]" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Loading Indicator */}
      {(isUploading || sendMessageMutation.isPending) && (
        <div className="p-4 border-t border-[#3a3a3a] bg-[#3a3a3a]/50">
          <div className="flex items-center text-[#ffd700] text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ffd700] mr-2" />
            {isUploading ? 'Uploading image...' : 'Processing request...'}
          </div>
        </div>
      )}
    </div>
  );
}