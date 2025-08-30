import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, Image as ImageIcon } from "lucide-react";
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

interface UserLibraryProps {
  userId?: string;
}

export default function UserLibrary({ userId = 'default' }: UserLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch saved images
  const { data: savedImages = [], isLoading, error } = useQuery({
    queryKey: ['/api/library', userId, { tags: selectedTags }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
      }
      const url = `/api/library/${userId}${
        params.toString() ? `?${params.toString()}` : ''
      }`;
      const response = await apiRequest('GET', url);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
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

  // Get all unique tags from saved images
  const allTags = Array.from(
    new Set(
      Array.isArray(savedImages) 
        ? savedImages.flatMap((image: SavedImage) => image.tags || [])
        : []
    )
  );

  const handleDeleteImage = (imageId: string) => {
    if (confirm('Are you sure you want to delete this image from your library?')) {
      deleteImageMutation.mutate(imageId);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Error loading library: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Image Library</h1>
        <div className="flex items-center gap-2">
          <ImageIcon className="w-6 h-6" />
          <span className="text-sm text-muted-foreground">
            {filteredImages.length} images
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search images by title or prompt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-images"
          />
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Filter by tags:</h3>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                  data-testid={`badge-tag-${tag}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="aspect-square bg-muted rounded-lg mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No images in your library</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedTags.length > 0
              ? "No images match your search criteria"
              : "Save generated images to build your library"}
          </p>
          {(searchTerm || selectedTags.length > 0) && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setSelectedTags([]);
              }}
              data-testid="button-clear-filters"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredImages.map((image: SavedImage) => (
            <Card key={image.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm truncate" title={image.title}>
                  {image.title}
                </CardTitle>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {new Date(image.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteImage(image.id)}
                    disabled={deleteImageMutation.isPending}
                    data-testid={`button-delete-${image.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  <img
                    src={image.objectPath}
                    alt={image.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => window.open(image.objectPath, '_blank')}
                    data-testid={`img-saved-${image.id}`}
                  />
                </div>
                
                {image.prompt && (
                  <p className="text-xs text-muted-foreground line-clamp-2" title={image.prompt}>
                    <span className="font-medium">Prompt:</span> {image.prompt}
                  </p>
                )}
                
                {image.tags && image.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {image.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
