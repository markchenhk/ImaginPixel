import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Trash2, Download, Search, Calendar } from "lucide-react";
import { useState } from "react";
import { getQueryFn } from "@/lib/queryClient";
import { SavedImage } from "@shared/schema";

export default function Gallery() {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch user's saved images
  const { data: savedImages = [], isLoading } = useQuery<SavedImage[]>({
    queryKey: ['/api/library'],
    queryFn: getQueryFn({ on401: "returnNull" })
  });

  const filteredImages = savedImages.filter(image =>
    image.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    image.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDownload = async (image: SavedImage) => {
    try {
      const response = await fetch(image.objectPath);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.title + '.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Gallery</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-[#1a1a1a] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Gallery</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#888888]" />
            <Input
              placeholder="Search images or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#1a1a1a] border-[#2a2a2a] text-white"
              data-testid="search-gallery"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[#ffd700]">{savedImages.length}</div>
              <div className="text-sm text-[#888888]">Total Images</div>
            </CardContent>
          </Card>
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[#ffd700]">
                {Math.round(savedImages.length * 2.3)}MB
              </div>
              <div className="text-sm text-[#888888]">Storage Used</div>
            </CardContent>
          </Card>
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[#ffd700]">
                {new Set(savedImages.flatMap(img => img.tags || [])).size}
              </div>
              <div className="text-sm text-[#888888]">Unique Tags</div>
            </CardContent>
          </Card>
        </div>

        {/* Images Grid */}
        {filteredImages.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[#888888] mb-4">
              {savedImages.length === 0 ? 'No images saved yet' : 'No images match your search'}
            </div>
            <div className="text-sm text-[#666666]">
              {savedImages.length === 0 
                ? 'Start creating and saving images in the AI Image Editor'
                : 'Try adjusting your search terms'
              }
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredImages.map((image) => (
              <Card key={image.id} className="bg-[#1a1a1a] border-[#2a2a2a] group overflow-hidden">
                <div className="aspect-square relative overflow-hidden">
                  <img
                    src={image.objectPath}
                    alt={image.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    data-testid={`gallery-image-${image.id}`}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0 bg-black/70 hover:bg-black/90"
                        onClick={() => handleDownload(image)}
                        data-testid={`download-${image.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-white truncate mb-2">{image.title}</h3>
                  <div className="flex items-center justify-between text-xs text-[#888888] mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {image.createdAt ? new Date(image.createdAt).toLocaleDateString() : 'Unknown date'}
                    </div>
                  </div>
                  {image.tags && image.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {image.tags.slice(0, 3).map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs bg-[#2a2a2a] text-[#cccccc] hover:bg-[#3a3a3a]"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {image.tags.length > 3 && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-[#2a2a2a] text-[#cccccc]"
                        >
                          +{image.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}