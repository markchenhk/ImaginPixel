import { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  RotateCw, 
  RotateCcw, 
  FlipHorizontal, 
  FlipVertical,
  Crop,
  Type,
  Palette,
  Filter,
  Layers,
  Settings,
  Save,
  Upload,
  Undo,
  Redo,
  Move,
  ZoomIn,
  ZoomOut,
  Grid,
  Eye,
  EyeOff,
  Maximize,
  Focus,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface ImageEditorPanelProps {
  imageUrl: string | null;
  onSaveToLibrary?: (imageUrl: string, title: string) => void;
}

interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  shadows: number;
  highlights: number;
  sharpen: number;
  blur: number;
  noise: number;
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  visible: boolean;
}

export default function ImageEditorPanel({ imageUrl, onSaveToLibrary }: ImageEditorPanelProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState('adjustments');
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(false);
  
  // Filter settings
  const [filters, setFilters] = useState<FilterSettings>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    shadows: 0,
    highlights: 0,
    sharpen: 0,
    blur: 0,
    noise: 0
  });
  
  // Canvas settings
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [originalImageSize, setOriginalImageSize] = useState({ width: 800, height: 600 });
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  
  // Text elements
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  
  // History for undo/redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Zoom presets and functions
  const zoomPresets = [25, 50, 75, 100, 150, 200, 300, 400];
  
  const fitToScreen = () => {
    if (!originalImageSize.width || !originalImageSize.height) return;
    
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth - 40; // Account for padding
    const containerHeight = container.clientHeight - 40;
    
    const scaleX = containerWidth / originalImageSize.width;
    const scaleY = containerHeight / originalImageSize.height;
    const scale = Math.min(scaleX, scaleY);
    
    const newZoom = Math.round(scale * 100);
    setZoom(Math.max(10, Math.min(400, newZoom)));
  };
  
  const setActualSize = () => setZoom(100);
  
  const handleZoomChange = (newZoom: number) => {
    setZoom(Math.max(10, Math.min(400, newZoom)));
  };
  
  // Mouse wheel zoom
  const handleWheelZoom = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      const newZoom = zoom + delta;
      handleZoomChange(newZoom);
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '0':
            e.preventDefault();
            fitToScreen();
            break;
          case '1':
            e.preventDefault();
            setActualSize();
            break;
          case '=':
          case '+':
            e.preventDefault();
            handleZoomChange(zoom + 25);
            break;
          case '-':
            e.preventDefault();
            handleZoomChange(zoom - 25);
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoom]);

  // Function to fit image dimensions to a maximum size while preserving aspect ratio
  const fitImageToMaxSize = (imgWidth: number, imgHeight: number, maxWidth = 1200, maxHeight = 800) => {
    const aspectRatio = imgWidth / imgHeight;
    
    let newWidth = imgWidth;
    let newHeight = imgHeight;
    
    // Scale down if image is larger than max dimensions
    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = newWidth / aspectRatio;
    }
    
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * aspectRatio;
    }
    
    return { width: Math.round(newWidth), height: Math.round(newHeight) };
  };

  const applyFilters = () => {
    if (!canvasRef.current || !imageUrl) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Store original image dimensions
      setOriginalImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply transformations
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      
      // Apply filters via CSS filter
      const filterStr = [
        `brightness(${100 + filters.brightness}%)`,
        `contrast(${100 + filters.contrast}%)`,
        `saturate(${100 + filters.saturation}%)`,
        `hue-rotate(${filters.hue}deg)`,
        filters.blur > 0 ? `blur(${filters.blur}px)` : '',
        filters.sharpen > 0 ? `contrast(${100 + filters.sharpen * 2}%)` : ''
      ].filter(Boolean).join(' ');
      
      ctx.filter = filterStr;
      
      // Draw image maintaining aspect ratio
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      ctx.restore();
      
      // Draw text elements
      textElements.forEach(textEl => {
        if (textEl.visible) {
          ctx.font = `${textEl.fontWeight} ${textEl.fontSize}px ${textEl.fontFamily}`;
          ctx.fillStyle = textEl.color;
          ctx.fillText(textEl.text, textEl.x, textEl.y);
        }
      });
    };
    
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl);
    };
    
    // Add cache-busting parameter to ensure new images load properly
    const cacheBustUrl = imageUrl.includes('?') 
      ? `${imageUrl}&t=${Date.now()}` 
      : `${imageUrl}?t=${Date.now()}`;
    
    img.src = cacheBustUrl;
  };

  const updateFilter = (key: keyof FilterSettings, value: number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      shadows: 0,
      highlights: 0,
      sharpen: 0,
      blur: 0,
      noise: 0
    });
  };

  const addTextElement = () => {
    if (!newText.trim()) return;
    
    const textEl: TextElement = {
      id: Date.now().toString(),
      text: newText,
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontWeight: 'normal',
      visible: true
    };
    
    setTextElements(prev => [...prev, textEl]);
    setNewText('');
    setSelectedTextId(textEl.id);
  };

  const updateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ));
  };

  const deleteTextElement = (id: string) => {
    setTextElements(prev => prev.filter(el => el.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  };

  const exportImage = (format: 'png' | 'jpg' | 'webp' = 'png', quality = 0.9) => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `edited-image.${format}`;
    
    if (format === 'jpg') {
      link.href = canvasRef.current.toDataURL('image/jpeg', quality);
    } else if (format === 'webp') {
      link.href = canvasRef.current.toDataURL('image/webp', quality);
    } else {
      link.href = canvasRef.current.toDataURL('image/png');
    }
    
    link.click();
    
    toast({
      title: "Image exported",
      description: `Image saved as ${format.toUpperCase()}`,
    });
  };

  const applyTemplate = (template: 'product-card' | 'social-post' | 'banner' | 'square') => {
    switch (template) {
      case 'product-card':
        setCanvasSize({ width: 400, height: 600 });
        setFilters(prev => ({ ...prev, brightness: 10, contrast: 15, saturation: 20 }));
        break;
      case 'social-post':
        setCanvasSize({ width: 1080, height: 1080 });
        setFilters(prev => ({ ...prev, saturation: 30, contrast: 20 }));
        break;
      case 'banner':
        setCanvasSize({ width: 1200, height: 400 });
        setFilters(prev => ({ ...prev, brightness: 5, contrast: 10 }));
        break;
      case 'square':
        setCanvasSize({ width: 800, height: 800 });
        break;
    }
    
    toast({
      title: "Template applied",
      description: `Canvas resized for ${template.replace('-', ' ')} format`,
    });
  };

  // Apply effects when filters or transformations change
  useEffect(() => {
    if (imageUrl) {
      applyFilters();
    }
  }, [filters, rotation, flipH, flipV, textElements, imageUrl, canvasSize]);
  
  // Reset filters and adjust canvas size when a new image is loaded
  useEffect(() => {
    if (imageUrl) {
      console.log('Image Editor: Resetting filters for new image');
      resetFilters();
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setTextElements([]);
      
      // Load image to get natural dimensions and adjust canvas size
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        console.log('Image Editor: Natural dimensions:', naturalWidth, 'x', naturalHeight);
        
        // Fit to maximum canvas size while preserving aspect ratio
        const fittedSize = fitImageToMaxSize(naturalWidth, naturalHeight, 1200, 800);
        
        console.log('Image Editor: Setting canvas size to:', fittedSize.width, 'x', fittedSize.height);
        setCanvasSize(fittedSize);
        setOriginalImageSize({ width: naturalWidth, height: naturalHeight });
      };
      
      // Add cache-busting parameter to ensure new images load properly
      const cacheBustUrl = imageUrl.includes('?') 
        ? `${imageUrl}&t=${Date.now()}` 
        : `${imageUrl}?t=${Date.now()}`;
      
      img.src = cacheBustUrl;
    }
  }, [imageUrl]);

  if (!imageUrl) {
    return (
      <div className="w-full h-full border-l border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-white mb-2">Product Editor</h2>
          <p className="text-sm text-[#888888]">
            Professional editing tools for E-commerce and marketing materials
          </p>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 bg-[#2a2a2a] rounded-lg flex items-center justify-center mb-4">
            <Palette className="w-8 h-8 text-[#888888]" />
          </div>
          <p className="text-sm text-[#888888] mb-2">No image to edit</p>
          <p className="text-xs text-[#666666] mb-4">
            Upload and process an image to start editing
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-[#666666]">
            <div>✨ Color adjustments</div>
            <div>🎨 Text overlays</div>
            <div>🔄 Canvas tools</div>
            <div>📤 Export options</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full border-l border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Product Editor</h2>
          <div className="flex items-center gap-2">
            {/* Fit to Screen */}
            <Button
              variant="ghost"
              size="sm"
              onClick={fitToScreen}
              title="Fit to Screen (Ctrl+0)"
              data-testid="zoom-fit"
            >
              <Maximize className="w-4 h-4" />
            </Button>
            
            {/* Actual Size */}
            <Button
              variant="ghost"
              size="sm"
              onClick={setActualSize}
              title="Actual Size (Ctrl+1)"
              data-testid="zoom-actual"
            >
              <Focus className="w-4 h-4" />
            </Button>
            
            {/* Zoom Out */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleZoomChange(zoom - 25)}
              title="Zoom Out (Ctrl+-)"
              data-testid="zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            
            {/* Zoom Dropdown */}
            <Select value={zoom.toString()} onValueChange={(value) => handleZoomChange(parseInt(value))}>
              <SelectTrigger className="w-20 h-8 text-xs bg-[#2a2a2a] border-[#3a3a3a]">
                <SelectValue>{zoom}%</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a2a] border-[#3a3a3a]">
                {zoomPresets.map((preset) => (
                  <SelectItem key={preset} value={preset.toString()} className="text-xs">
                    {preset}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Zoom In */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleZoomChange(zoom + 25)}
              title="Zoom In (Ctrl++)"
              data-testid="zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            
            {/* Grid Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle Grid"
              data-testid="toggle-grid"
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs bg-[#ffd700] text-black">
          Professional Edition
        </Badge>
        
        {/* Zoom Instructions */}
        <div className="mt-2 text-xs text-[#888888]">
          💡 <strong>Zoom Tips:</strong> Use mouse wheel + Ctrl to zoom • Ctrl+0 to fit screen • Ctrl+1 for actual size
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 p-4 overflow-auto bg-[#0f0f0f]">
          <div className="flex items-center justify-center min-h-full">
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="border border-[#3a3a3a] rounded-lg shadow-lg max-w-full max-h-full"
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center'
              }}
              onWheel={handleWheelZoom}
              data-testid="editor-canvas"
            />
          </div>
        </div>

        {/* Tools Panel */}
        <div className="w-64 border-l border-[#2a2a2a] bg-[#1a1a1a] overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="w-full bg-[#2a2a2a] p-1">
              <TabsTrigger value="adjustments" className="flex-1 text-xs">
                <Palette className="w-3 h-3 mr-1" />
                Adjust
              </TabsTrigger>
              <TabsTrigger value="canvas" className="flex-1 text-xs">
                <Crop className="w-3 h-3 mr-1" />
                Canvas
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1 text-xs">
                <Type className="w-3 h-3 mr-1" />
                Text
              </TabsTrigger>
              <TabsTrigger value="export" className="flex-1 text-xs">
                <Download className="w-3 h-3 mr-1" />
                Export
              </TabsTrigger>
            </TabsList>

            {/* Color Adjustments Tab */}
            <TabsContent value="adjustments" className="p-3 space-y-3">
              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Color & Light</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Brightness</Label>
                    <Slider
                      value={[filters.brightness]}
                      onValueChange={(value) => updateFilter('brightness', value[0])}
                      min={-100}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{filters.brightness}</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Contrast</Label>
                    <Slider
                      value={[filters.contrast]}
                      onValueChange={(value) => updateFilter('contrast', value[0])}
                      min={-100}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{filters.contrast}</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Saturation</Label>
                    <Slider
                      value={[filters.saturation]}
                      onValueChange={(value) => updateFilter('saturation', value[0])}
                      min={-100}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{filters.saturation}</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Hue</Label>
                    <Slider
                      value={[filters.hue]}
                      onValueChange={(value) => updateFilter('hue', value[0])}
                      min={-180}
                      max={180}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{filters.hue}°</span>
                  </div>
                  
                  <Separator className="bg-[#3a3a3a]" />
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Sharpen</Label>
                    <Slider
                      value={[filters.sharpen]}
                      onValueChange={(value) => updateFilter('sharpen', value[0])}
                      min={0}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{filters.sharpen}</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Blur</Label>
                    <Slider
                      value={[filters.blur]}
                      onValueChange={(value) => updateFilter('blur', value[0])}
                      min={0}
                      max={20}
                      step={0.1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{filters.blur}px</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="w-full border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#2a2a2a]"
                  >
                    Reset All
                  </Button>
                </CardContent>
              </Card>

              {/* E-commerce Presets */}
              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white">E-commerce Presets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, brightness: 15, contrast: 20, saturation: 25 }))}
                    className="w-full justify-start text-left hover:bg-[#3a3a3a]"
                  >
                    Product Enhancement
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, brightness: 10, contrast: 15, saturation: 30, sharpen: 20 }))}
                    className="w-full justify-start text-left hover:bg-[#3a3a3a]"
                  >
                    Vibrant Marketing
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, brightness: -5, contrast: 25, saturation: -10 }))}
                    className="w-full justify-start text-left hover:bg-[#3a3a3a]"
                  >
                    Professional Clean
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Canvas Tools Tab */}
            <TabsContent value="canvas" className="p-3 space-y-3">
              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white">Transform</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRotation((prev) => prev + 90)}
                      className="border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    >
                      <RotateCw className="w-4 h-4 mr-1" />
                      Rotate 90°
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRotation((prev) => prev - 90)}
                      className="border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Rotate -90°
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFlipH(!flipH)}
                      className="border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    >
                      <FlipHorizontal className="w-4 h-4 mr-1" />
                      Flip H
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFlipV(!flipV)}
                      className="border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    >
                      <FlipVertical className="w-4 h-4 mr-1" />
                      Flip V
                    </Button>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Rotation</Label>
                    <Slider
                      value={[rotation]}
                      onValueChange={(value) => setRotation(value[0])}
                      min={-180}
                      max={180}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{rotation}°</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white">Canvas Size</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-[#e0e0e0]">Width</Label>
                      <Input
                        type="number"
                        value={canvasSize.width}
                        onChange={(e) => setCanvasSize(prev => ({ ...prev, width: parseInt(e.target.value) || 800 }))}
                        className="bg-[#1a1a1a] border-[#3a3a3a] text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#e0e0e0]">Height</Label>
                      <Input
                        type="number"
                        value={canvasSize.height}
                        onChange={(e) => setCanvasSize(prev => ({ ...prev, height: parseInt(e.target.value) || 600 }))}
                        className="bg-[#1a1a1a] border-[#3a3a3a] text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-[#e0e0e0]">Templates</Label>
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => applyTemplate('product-card')}
                        className="text-xs hover:bg-[#3a3a3a]"
                      >
                        Product Card
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => applyTemplate('social-post')}
                        className="text-xs hover:bg-[#3a3a3a]"
                      >
                        Social Post
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => applyTemplate('banner')}
                        className="text-xs hover:bg-[#3a3a3a]"
                      >
                        Banner
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => applyTemplate('square')}
                        className="text-xs hover:bg-[#3a3a3a]"
                      >
                        Square
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Text Tab */}
            <TabsContent value="text" className="p-3 space-y-3">
              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white">Add Text</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Text Content</Label>
                    <Input
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder="Enter text..."
                      className="bg-[#1a1a1a] border-[#3a3a3a] text-white"
                    />
                  </div>
                  <Button
                    onClick={addTextElement}
                    disabled={!newText.trim()}
                    className="w-full bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
                  >
                    Add Text
                  </Button>
                </CardContent>
              </Card>

              {/* Text Elements List */}
              {textElements.length > 0 && (
                <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-white">Text Elements</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {textElements.map((textEl) => (
                      <div
                        key={textEl.id}
                        className={`p-2 rounded border ${
                          selectedTextId === textEl.id 
                            ? 'border-[#ffd700] bg-[#ffd700]/10' 
                            : 'border-[#3a3a3a] bg-[#1a1a1a]'
                        }`}
                        onClick={() => setSelectedTextId(textEl.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white truncate">{textEl.text}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateTextElement(textEl.id, { visible: !textEl.visible })}
                              className="w-6 h-6 p-0"
                            >
                              {textEl.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTextElement(textEl.id)}
                              className="w-6 h-6 p-0 text-red-400 hover:text-red-300"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                        
                        {selectedTextId === textEl.id && (
                          <div className="mt-2 space-y-2">
                            <div>
                              <Label className="text-xs text-[#e0e0e0]">Font Size</Label>
                              <Slider
                                value={[textEl.fontSize]}
                                onValueChange={(value) => updateTextElement(textEl.id, { fontSize: value[0] })}
                                min={8}
                                max={72}
                                step={1}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-[#e0e0e0]">Color</Label>
                              <Input
                                type="color"
                                value={textEl.color}
                                onChange={(e) => updateTextElement(textEl.id, { color: e.target.value })}
                                className="w-full h-8 bg-[#1a1a1a] border-[#3a3a3a]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export" className="p-3 space-y-3">
              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white">Export Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Button
                      onClick={() => exportImage('png')}
                      className="w-full border border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700] hover:bg-[#ffd700]/20"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export as PNG
                    </Button>
                    <Button
                      onClick={() => exportImage('jpg', 0.9)}
                      variant="outline"
                      className="w-full border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    >
                      Export as JPG
                    </Button>
                    <Button
                      onClick={() => exportImage('webp', 0.9)}
                      variant="outline"
                      className="w-full border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                    >
                      Export as WebP
                    </Button>
                  </div>
                  
                  {onSaveToLibrary && (
                    <>
                      <Separator className="bg-[#3a3a3a]" />
                      <Button
                        onClick={async () => {
                          if (canvasRef.current) {
                            try {
                              // Convert canvas to blob instead of data URL to reduce size
                              canvasRef.current.toBlob(async (blob) => {
                                if (blob && onSaveToLibrary) {
                                  // Create a temporary file and upload to S3
                                  const formData = new FormData();
                                  formData.append('image', blob, 'edited-image.png');
                                  
                                  // Upload to server which will handle S3 upload
                                  const uploadResponse = await fetch('/api/upload-image', {
                                    method: 'POST',
                                    body: formData,
                                  });
                                  
                                  if (uploadResponse.ok) {
                                    const { imageUrl } = await uploadResponse.json();
                                    onSaveToLibrary(imageUrl, 'Edited Image');
                                  } else {
                                    throw new Error('Failed to upload image');
                                  }
                                }
                              }, 'image/png', 0.9);
                            } catch (error) {
                              console.error('Error saving image:', error);
                              toast({
                                title: "Error",
                                description: "Failed to save image to library",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                        variant="outline"
                        className="w-full border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#3a3a3a]"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save to Library
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="w-full justify-start text-left hover:bg-[#3a3a3a]"
                  >
                    Reset All Adjustments
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRotation(0);
                      setFlipH(false);
                      setFlipV(false);
                    }}
                    className="w-full justify-start text-left hover:bg-[#3a3a3a]"
                  >
                    Reset Transformations
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTextElements([])}
                    className="w-full justify-start text-left hover:bg-[#3a3a3a]"
                  >
                    Clear All Text
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}