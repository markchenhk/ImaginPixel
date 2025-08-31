import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  Download,
  Trash2,
  ImageIcon,
  Grid3X3,
  MoreHorizontal,
} from "lucide-react";

interface SavedImage {
  id: string;
  title: string;
  objectPath: string;
  prompt: string;
  tags: string[];
  createdAt: string;
}

export function GalleryView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);
  const { user, isAuthenticated } = useAuth();
  
  // Get user ID from authenticated user
  const userId = user?.id || 'default';

  // Fetch saved images
  const { data: savedImages = [], isLoading } = useQuery<SavedImage[]>({
    queryKey: ['/api/library', userId],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      const response = await apiRequest('GET', `/api/library/${userId}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isAuthenticated, // Only run query when user is authenticated
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const response = await apiRequest('DELETE', `/api/library/${imageId}?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/library', userId] });
      toast({
        title: "Success",
        description: "Image deleted from library",
      });
      if (selectedImage) {
        setSelectedImage(null);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    },
  });

  const filteredImages = savedImages.filter((image) =>
    image.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    image.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDeleteImage = (imageId: string) => {
    deleteImageMutation.mutate(imageId);
  };

  const handleDownloadImage = (imageUrl: string, title: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${title}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="flex-1 flex bg-[#1e1e1e]">
      {/* Main Gallery Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#ffd700] rounded-lg flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-black" />
              </div>
              <h2 className="text-xl font-semibold text-white">Gallery</h2>
              <span className="text-sm text-[#888888]">
                {filteredImages.length} images
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-[#888888]" />
            </div>
          </div>
          
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#888888]" />
            <Input
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#2a2a2a] border-[#3a3a3a] text-white placeholder:text-[#888888] focus:bg-[#2a2a2a] focus:border-[#ffd700]"
              data-testid="input-search-gallery"
            />
          </div>
        </div>

        {/* Gallery Grid */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="animate-pulse bg-[#2a2a2a] border-[#3a3a3a]">
                    <CardContent className="p-0">
                      <div className="aspect-square bg-[#3a3a3a] rounded-t"></div>
                      <div className="p-3">
                        <div className="h-4 bg-[#3a3a3a] rounded mb-2"></div>
                        <div className="h-3 bg-[#3a3a3a] rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#2a2a2a] rounded-full flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-[#888888]" />
                </div>
                <p className="text-lg font-medium text-white mb-2">
                  {searchTerm ? "No matches found" : "No images in your library"}
                </p>
                <p className="text-sm text-[#888888]">
                  {searchTerm 
                    ? "Try a different search term" 
                    : "Create some images in the chat to see them here"
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredImages.map((image: SavedImage) => (
                  <Card 
                    key={image.id} 
                    className={`group cursor-pointer transition-all hover:shadow-lg bg-[#2a2a2a] border-[#3a3a3a] hover:border-[#ffd700] ${
                      selectedImage?.id === image.id ? 'ring-2 ring-[#ffd700] border-[#ffd700]' : ''
                    }`}
                    onClick={() => setSelectedImage(selectedImage?.id === image.id ? null : image)}
                  >
                    <CardContent className="p-0">
                      <div className="aspect-square overflow-hidden rounded-t relative">
                        <img
                          src={image.objectPath}
                          alt={image.title}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        
                        {/* Action Buttons */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-8 h-8 p-0 bg-black/50 hover:bg-black/70 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImage(image.objectPath, image.title);
                            }}
                            data-testid={`download-${image.id}`}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-8 h-8 p-0 bg-black/50 hover:bg-red-600 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(image.id);
                            }}
                            data-testid={`delete-${image.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-3">
                        <h4 className="text-sm font-medium text-white truncate mb-1">
                          {image.title}
                        </h4>
                        <p className="text-xs text-[#888888]">
                          {formatDate(image.createdAt)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Image Detail Sidebar */}
      {selectedImage && (
        <div className="w-80 border-l border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
          <div className="p-4 border-b border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">Image Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImage(null)}
                className="text-[#888888] hover:text-white"
              >
                ✕
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Full Image */}
              <div className="aspect-square overflow-hidden rounded-lg">
                <img
                  src={selectedImage.objectPath}
                  alt={selectedImage.title}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Details */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[#888888] uppercase tracking-wide">Title</label>
                  <p className="text-sm text-white mt-1">{selectedImage.title}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-[#888888] uppercase tracking-wide">Created</label>
                  <p className="text-sm text-white mt-1">{formatDate(selectedImage.createdAt)}</p>
                </div>
                
                {selectedImage.prompt && (
                  <div>
                    <label className="text-xs font-medium text-[#888888] uppercase tracking-wide">Prompt</label>
                    <p className="text-sm text-white mt-1 leading-relaxed">{selectedImage.prompt}</p>
                  </div>
                )}
                
                {selectedImage.tags.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-[#888888] uppercase tracking-wide">Tags</label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedImage.tags.map((tag) => (
                        <span 
                          key={tag}
                          className="px-2 py-1 text-xs bg-[#2a2a2a] text-[#e0e0e0] rounded-full border border-[#3a3a3a]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleDownloadImage(selectedImage.objectPath, selectedImage.title)}
                  className="flex-1 bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-medium"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleDeleteImage(selectedImage.id)}
                  className="px-3 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}