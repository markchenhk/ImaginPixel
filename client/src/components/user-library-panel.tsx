import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, Image as ImageIcon, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  userId?: string;
  processedImageUrl?: string | null;
  onSaveImage?: () => void;
}

export default function UserLibraryPanel({ 
  userId = 'default', 
  processedImageUrl,
  onSaveImage 
}: UserLibraryPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch saved images
  const { data: savedImages = [], isLoading, error } = useQuery({
    queryKey: ['/api/library', userId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/library/${userId}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Save image mutation
  const saveImageMutation = useMutation({
    mutationFn: async (imageData: { 
      title: string; 
      objectPath: string; 
      prompt?: string; 
    }) => {
      const response = await apiRequest('POST', '/api/library/save', {
        userId,
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
    <div className="w-64 h-full border-l border-border bg-gradient-to-b from-card to-muted/10 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">My Library</h2>
            <p className="text-xs text-muted-foreground">Generated images will appear here</p>
          </div>
          <div className="flex items-center gap-2 text-sm bg-secondary/50 rounded-full px-3 py-1">
            <ImageIcon className="w-3 h-3 text-blue-500" />
            <span className="font-medium">{filteredImages.length}</span>
          </div>
        </div>
        
        {/* Save current image button */}
        {processedImageUrl && (
          <Button 
            onClick={handleSaveCurrentImage}
            disabled={saveImageMutation.isPending}
            size="default"
            className="w-full mb-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
            data-testid="button-save-to-library"
          >
            <Plus className="w-4 h-4 mr-2" />
            Save Current Image
          </Button>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 h-8 text-xs"
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
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {searchTerm ? "No matches found" : "No saved images yet"}
            </p>
            {!searchTerm && (
              <p className="text-xs text-muted-foreground">
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