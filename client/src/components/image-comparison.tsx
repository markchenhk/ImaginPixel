import { useState, useRef, useEffect } from 'react';
import { Eye, Download, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageComparisonProps {
  originalImageUrl: string;
  processedImageUrl?: string;
  className?: string;
}

export default function ImageComparison({ 
  originalImageUrl, 
  processedImageUrl,
  className 
}: ImageComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'comparison' | 'original' | 'processed'>('comparison');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = () => {
    if (processedImageUrl && viewMode !== 'original') {
      downloadImage(processedImageUrl, 'enhanced-image.jpg');
    } else {
      downloadImage(originalImageUrl, 'original-image.jpg');
    }
  };

  const toggleViewMode = () => {
    if (viewMode === 'comparison') {
      setViewMode('original');
    } else if (viewMode === 'original' && processedImageUrl) {
      setViewMode('processed');
    } else {
      setViewMode('comparison');
    }
  };

  if (!originalImageUrl) {
    return (
      <div className={cn(
        "flex items-center justify-center h-full bg-card rounded-lg border-2 border-dashed border-border",
        className
      )}>
        <div className="text-center text-muted-foreground">
          <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No image selected</p>
          <p className="text-sm">Upload an image to see the preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Preview Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-medium">Image Preview</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleViewMode}
              data-testid="toggle-view-button"
            >
              <Eye className="w-4 h-4 mr-1" />
              {viewMode === 'comparison' ? 'Before/After' : 
               viewMode === 'original' ? 'Original' : 'Enhanced'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              data-testid="fit-screen-button"
            >
              <Maximize className="w-4 h-4 mr-1" />
              Fit to screen
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!processedImageUrl && (
            <div className="flex items-center gap-2 text-sm">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="text-muted-foreground">Processing...</span>
            </div>
          )}
          
          <Button
            onClick={handleDownload}
            disabled={!originalImageUrl}
            className="bg-green-600 hover:bg-green-700"
            data-testid="download-button"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Image Display Area */}
      <div className="flex-1 p-6">
        <div 
          ref={containerRef}
          className="relative rounded-lg overflow-hidden bg-card shadow-lg h-full"
          data-testid="image-comparison-container"
        >
          {viewMode === 'comparison' && processedImageUrl ? (
            <>
              {/* Before/After Comparison */}
              <div className="absolute inset-0 flex">
                {/* Original Image (Left) */}
                <div 
                  className="relative overflow-hidden"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-xs font-medium z-10">
                    Original
                  </div>
                  <img 
                    src={originalImageUrl}
                    alt="Original image"
                    className="w-full h-full object-cover"
                    style={{ width: `${100 * 100 / sliderPosition}%` }}
                    data-testid="original-image"
                  />
                </div>
                
                {/* Processed Image (Right) */}
                <div 
                  className="relative overflow-hidden"
                  style={{ width: `${100 - sliderPosition}%` }}
                >
                  <div className="absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-xs font-medium z-10">
                    Enhanced
                  </div>
                  <img 
                    src={processedImageUrl}
                    alt="Enhanced image"
                    className="w-full h-full object-cover"
                    style={{ 
                      width: `${100 * 100 / (100 - sliderPosition)}%`,
                      marginLeft: `-${100 * sliderPosition / (100 - sliderPosition)}%`
                    }}
                    data-testid="processed-image"
                  />
                </div>
              </div>
              
              {/* Comparison Slider */}
              <div 
                className="comparison-slider"
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={handleMouseDown}
                data-testid="comparison-slider"
              />
            </>
          ) : (
            /* Single Image View */
            <div className="relative w-full h-full">
              <img 
                src={viewMode === 'processed' && processedImageUrl ? processedImageUrl : originalImageUrl}
                alt={viewMode === 'processed' ? 'Enhanced image' : 'Original image'}
                className="w-full h-full object-contain"
                data-testid={`single-image-${viewMode}`}
              />
              <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-xs font-medium">
                {viewMode === 'processed' ? 'Enhanced' : 'Original'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
