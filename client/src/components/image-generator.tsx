import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, Sparkles, Image as ImageIcon, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function ImageGenerator() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [imageCount, setImageCount] = useState('1');
  const [style, setStyle] = useState('multipurpose');

  const generateImageMutation = useMutation({
    mutationFn: async () => {
      if (!prompt.trim()) {
        throw new Error('Please enter a prompt');
      }

      // Create a conversation first
      const conversationResponse = await apiRequest('POST', '/api/conversations', {
        title: prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt
      });
      const conversation = await conversationResponse.json();

      // Generate image without uploading an image (pure text-to-image)
      const response = await apiRequest('POST', '/api/process-image', {
        conversationId: conversation.id,
        prompt: prompt,
        // No imageUrl - this will trigger pure image generation
      });
      
      return response.json();
    },
    onMutate: () => {
      setIsGenerating(true);
      setGeneratedImage(null);
    },
    onSuccess: (result) => {
      // Start polling for completion
      const pollJob = async () => {
        try {
          const jobResponse = await apiRequest('GET', `/api/processing-jobs/${result.aiMessage.id}`);
          const job = await jobResponse.json();
          
          if (job.status === 'completed' && job.processedImageUrl) {
            setGeneratedImage(job.processedImageUrl);
            setIsGenerating(false);
            toast({
              title: 'Image generated!',
              description: 'Your AI-generated image is ready.',
            });
          } else if (job.status === 'processing') {
            setTimeout(pollJob, 2000);
          } else if (job.status === 'error') {
            setIsGenerating(false);
            toast({
              title: 'Generation failed',
              description: job.errorMessage || 'Unknown error occurred',
              variant: 'destructive',
            });
          }
        } catch (error) {
          setIsGenerating(false);
          toast({
            title: 'Error',
            description: 'Failed to check generation status',
            variant: 'destructive',
          });
        }
      };
      
      setTimeout(pollJob, 1000);
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      toast({
        title: 'Generation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    generateImageMutation.mutate();
  };

  return (
    <div className="flex-1 bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search" 
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
          
          {/* Top Right Actions */}
          <div className="flex items-center gap-4">
            <Button className="bg-yellow-400 text-black hover:bg-yellow-500 font-medium">
              Subscribe Now
            </Button>
            <Button variant="ghost" className="text-gray-400 hover:text-white">
              Business
            </Button>
            <Button variant="ghost" className="text-gray-400 hover:text-white">
              Pricing
            </Button>
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">MC</span>
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-2">Transform your ideas into stunning visuals</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Generation Interface */}
        <div className="max-w-4xl mx-auto">
          {/* Mode Tabs */}
          <Tabs defaultValue="text-to-image" className="mb-6">
            <TabsList className="bg-gray-800 border-gray-700">
              <TabsTrigger 
                value="text-to-image" 
                className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Text to Image
              </TabsTrigger>
              <TabsTrigger 
                value="image-to-image" 
                className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Image to Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text-to-image" className="mt-6">
              {/* Prompt Input */}
              <div className="bg-gray-900 rounded-lg p-6 mb-6">
                <Textarea
                  placeholder="Describe the image you want to create, in any language"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-32 bg-transparent border-0 text-lg placeholder-gray-500 resize-none focus:ring-0"
                  maxLength={1000}
                  data-testid="prompt-input"
                />
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-gray-500">
                    {prompt.length}/1000 characters
                  </div>
                  <Button 
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isGenerating}
                    className="bg-yellow-400 text-black hover:bg-yellow-500 font-medium px-8"
                    data-testid="generate-button"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate for Free
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Generation Controls */}
              <div className="flex items-center gap-4 mb-8">
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="multipurpose">Multipurpose</SelectItem>
                    <SelectItem value="realistic">Realistic</SelectItem>
                    <SelectItem value="artistic">Artistic</SelectItem>
                    <SelectItem value="cartoon">Cartoon</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="w-24 bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={imageCount} onValueChange={setImageCount}>
                  <SelectTrigger className="w-32 bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="1">1 image</SelectItem>
                    <SelectItem value="2">2 images</SelectItem>
                    <SelectItem value="4">4 images</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  className="bg-yellow-400 text-black hover:bg-yellow-500 font-medium"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                >
                  Generate for Free ✨
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Results Area */}
          <div className="mt-8">
            <Tabs defaultValue="style-catalog">
              <TabsList className="bg-gray-800 border-gray-700 mb-6">
                <TabsTrigger 
                  value="style-catalog"
                  className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
                >
                  Style Catalog
                </TabsTrigger>
                <TabsTrigger 
                  value="my-creations"
                  className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
                >
                  My Creations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="style-catalog">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Loading State */}
                  {isGenerating && (
                    <div className="bg-gray-800 rounded-lg p-8 flex flex-col items-center justify-center min-h-64">
                      <Sparkles className="w-8 h-8 text-yellow-400 animate-spin mb-4" />
                      <p className="text-gray-400">Generating your image...</p>
                    </div>
                  )}

                  {/* Generated Image */}
                  {generatedImage && (
                    <div className="bg-gray-800 rounded-lg overflow-hidden hover:scale-105 transition-transform">
                      <img 
                        src={generatedImage} 
                        alt="Generated artwork" 
                        className="w-full h-64 object-cover"
                        data-testid="generated-image"
                      />
                      <div className="p-4">
                        <p className="text-sm text-gray-400 truncate">{prompt}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="secondary" className="bg-gray-700 text-gray-300">
                            AI Generated
                          </Badge>
                          <Button size="sm" variant="ghost">
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Placeholder when no generation */}
                  {!isGenerating && !generatedImage && (
                    <div className="bg-gray-800 rounded-lg p-8 flex flex-col items-center justify-center min-h-64 border-2 border-dashed border-gray-600">
                      <ImageIcon className="w-12 h-12 text-gray-600 mb-4" />
                      <p className="text-gray-400 text-center">
                        Your generated images will appear here
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="my-creations">
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No creations yet. Start generating!</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Free Generation Notice */}
      {isGenerating && (
        <div className="fixed top-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-4 max-w-sm">
          <h3 className="font-medium mb-2">Generate free: 4 images, 1 video</h3>
          <p className="text-sm text-gray-400 mb-3">
            Generate your first AI images for free, then bring them to life with video.
          </p>
          <Button size="sm" className="w-full bg-yellow-400 text-black hover:bg-yellow-500">
            Start creating for free
          </Button>
        </div>
      )}
    </div>
  );
}