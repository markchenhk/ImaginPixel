import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, Image as ImageIcon, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface SavedImage {
  id: string;
  userId: string;
  title: string;
  objectPath: string;
  originalImagePath?: string;
  prompt?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface UserLibraryPanelProps {
  processedImageUrl?: string | null;
  onSaveImage?: () => void;
}

export default function UserLibraryPanel({ 
  processedImageUrl,
  onSaveImage 
}: UserLibraryPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  
  // Get user ID from authenticated user
  const userId = user?.id || 'default';

  // Fetch saved images
  const { data: savedImages = [], isLoading, error } = useQuery({
    queryKey: ['/api/library', userId],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      const response = await apiRequest('GET', `/api/library/${userId}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isAuthenticated, // Only run query when user is authenticated
  });

  // Save image mutation
  const saveImageMutation = useMutation({
    mutationFn: async (imageData: { 
      title: string; 
      objectPath: string; 
      prompt?: string; 
    }) => {
      const response = await apiRequest('POST', '/api/library/save', {
        ...imageData,
        tags: ['ai-generated']
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Image saved to library",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/library', userId] });
      onSaveImage?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to save image",
        variant: "destructive",
      });
    },
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const response = await apiRequest('DELETE', `/api/library/${imageId}?userId=${userId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Image deleted from library",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/library', userId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete image", 
        variant: "destructive",
      });
    },
  });

  // Filter images by search term
  const filteredImages = Array.isArray(savedImages)
    ? savedImages.filter((image: SavedImage) =>
        image.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        image.prompt?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const handleSaveCurrentImage = () => {
    if (!processedImageUrl) {
      toast({
        title: "No image to save",
        description: "Process an image first",
        variant: "destructive"
      });
      return;
    }

    const title = `AI Enhanced Image ${new Date().toLocaleDateString()}`;
    saveImageMutation.mutate({
      title,
      objectPath: processedImageUrl,
      prompt: "AI enhanced image"
    });
  };

  const handleDeleteImage = (imageId: string) => {
    if (confirm('Delete this image from your library?')) {
      deleteImageMutation.mutate(imageId);
    }
  };

  return (
    <div className="w-56 h-full border-l border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-white">Library</h2>
            <p className="text-xs text-[#888888]">{filteredImages.length} images</p>
          </div>
        </div>
        
        {/* Save current image button */}
        {processedImageUrl && (
          <Button 
            onClick={handleSaveCurrentImage}
            disabled={saveImageMutation.isPending}
            size="sm"
            className="w-full mb-3 bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-medium"
            data-testid="button-save-to-library"
          >
            <Plus className="w-4 h-4 mr-2" />
            Save Current
          </Button>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#888888]" />
          <Input
            placeholder="Search images..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-8 text-sm bg-[#2a2a2a] border-[#3a3a3a] text-white placeholder:text-[#888888] focus:bg-[#2a2a2a] focus:border-[#ffd700]"
            data-testid="input-search-library"
          />
        </div>
      </div>

      {/* Image Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-3">
                  <div className="aspect-square bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded mb-1"></div>
                  <div className="h-2 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#2a2a2a] rounded-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-[#888888]" />
            </div>
            <p className="text-sm font-medium text-white mb-1">
              {searchTerm ? "No matches found" : "No saved images yet"}
            </p>
            {!searchTerm && (
              <p className="text-xs text-[#888888]">
                Generated images will appear here
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredImages.map((image: SavedImage) => (
              <Card key={image.id} className="group">
                <CardContent className="p-3">
                  {/* Image */}
                  <div className="aspect-square mb-2 relative overflow-hidden rounded">
                    <img
                      src={image.objectPath}
                      alt={image.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 p-0"
                      onClick={() => handleDeleteImage(image.id)}
                      data-testid={`button-delete-${image.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {/* Title */}
                  <h4 className="text-xs font-medium mb-1 truncate">{image.title}</h4>
                  
                  {/* Prompt */}
                  {image.prompt && (
                    <p className="text-xs text-muted-foreground truncate mb-2">
                      {image.prompt}
                    </p>
                  )}

                  {/* Tags */}
                  {image.tags && image.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {image.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Date */}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(image.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}