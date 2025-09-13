import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  SkipBack,
  SkipForward,
  RotateCw, 
  RotateCcw,
  Download,
  Type,
  Settings,
  Save,
  Maximize,
  Filter,
  Palette,
  Layers,
  Eye,
  EyeOff,
  Clock
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

interface VideoEditorPanelProps {
  videoUrl: string | null;
  onSaveToLibrary?: (videoUrl: string, title: string) => void;
}

interface VideoSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
  grayscale: number;
}

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  visible: boolean;
  startTime: number;
  endTime: number;
}

export default function VideoEditorPanel({ videoUrl, onSaveToLibrary }: VideoEditorPanelProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeTab, setActiveTab] = useState('playback');
  
  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Video settings
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0,
    grayscale: 0
  });
  
  // Text overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  
  // Playback speeds
  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Video event handlers
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    
    if (isMuted) {
      videoRef.current.volume = volume;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const skipBackward = () => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, currentTime - 10);
    handleSeek(newTime);
  };

  const skipForward = () => {
    if (!videoRef.current) return;
    const newTime = Math.min(duration, currentTime + 10);
    handleSeek(newTime);
  };

  // Video filter updates
  const updateVideoSetting = (key: keyof VideoSettings, value: number) => {
    setVideoSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetVideoSettings = () => {
    setVideoSettings({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0,
      grayscale: 0
    });
  };

  // Apply CSS filters to video
  const getVideoFilter = () => {
    return [
      `brightness(${videoSettings.brightness}%)`,
      `contrast(${videoSettings.contrast}%)`,
      `saturate(${videoSettings.saturation}%)`,
      `hue-rotate(${videoSettings.hue}deg)`,
      videoSettings.blur > 0 ? `blur(${videoSettings.blur}px)` : '',
      `sepia(${videoSettings.sepia}%)`,
      `grayscale(${videoSettings.grayscale}%)`
    ].filter(Boolean).join(' ');
  };

  // Text overlay functions
  const addTextOverlay = () => {
    if (!newText.trim()) return;
    
    const textOverlay: TextOverlay = {
      id: Date.now().toString(),
      text: newText,
      x: 50, // percentage
      y: 50, // percentage
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      visible: true,
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration) // 5 second default duration
    };
    
    setTextOverlays(prev => [...prev, textOverlay]);
    setNewText('');
    setSelectedTextId(textOverlay.id);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(overlay => 
      overlay.id === id ? { ...overlay, ...updates } : overlay
    ));
  };

  const deleteTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(overlay => overlay.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
  };

  // Get currently visible text overlays
  const getVisibleTextOverlays = () => {
    return textOverlays.filter(overlay => 
      overlay.visible && 
      currentTime >= overlay.startTime && 
      currentTime <= overlay.endTime
    );
  };

  // Reset everything when video URL changes
  useEffect(() => {
    if (videoUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      resetVideoSettings();
      setTextOverlays([]);
      setSelectedTextId(null);
    }
  }, [videoUrl]);

  if (!videoUrl) {
    return (
      <div className="w-full h-full border-l border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-white mb-2">Video Editor</h2>
          <p className="text-sm text-[#888888]">
            Professional video editing tools for marketing and social media
          </p>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 bg-[#2a2a2a] rounded-lg flex items-center justify-center mb-4">
            <Play className="w-8 h-8 text-[#888888]" />
          </div>
          <p className="text-sm text-[#888888] mb-2">No video to edit</p>
          <p className="text-xs text-[#666666] mb-4">
            Generate a video from an image to start editing
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-[#666666]">
            <div>🎬 Video playback</div>
            <div>🎨 Text overlays</div>
            <div>⚡ Visual effects</div>
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
          <h2 className="text-lg font-semibold text-white">Video Editor</h2>
          <Badge variant="secondary" className="text-xs bg-[#ff6b6b] text-white">
            Video Studio
          </Badge>
        </div>
        <p className="text-xs text-[#888888]">
          {duration > 0 && `Duration: ${formatTime(duration)} • `}
          Professional video editing suite
        </p>
      </div>

      {/* Video Player Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Player */}
        <div className="flex-1 p-4 overflow-auto bg-[#0f0f0f]">
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                style={{ filter: getVideoFilter() }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                data-testid="video-player"
              />
              
              {/* Text Overlays */}
              {getVisibleTextOverlays().map(overlay => (
                <div
                  key={overlay.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${overlay.fontSize}px`,
                    color: overlay.color,
                    fontFamily: overlay.fontFamily,
                    fontWeight: overlay.fontWeight,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                  }}
                >
                  {overlay.text}
                </div>
              ))}
            </div>
            
            {/* Video Controls */}
            <div className="w-full max-w-4xl mt-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
              {/* Timeline */}
              <div className="mb-4">
                <Slider
                  value={[currentTime]}
                  onValueChange={(value) => handleSeek(value[0])}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  className="w-full"
                  data-testid="video-timeline"
                />
                <div className="flex justify-between text-xs text-[#888888] mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              
              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipBackward}
                  title="Skip backward 10s"
                  data-testid="skip-backward"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handlePlayPause}
                  className="w-12 h-12"
                  data-testid="play-pause"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipForward}
                  title="Skip forward 10s"
                  data-testid="skip-forward"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
                
                <Separator orientation="vertical" className="h-6 bg-[#3a3a3a]" />
                
                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    data-testid="mute-toggle"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    onValueChange={(value) => handleVolumeChange(value[0])}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-20"
                  />
                </div>
                
                {/* Playback Speed */}
                <Select value={playbackRate.toString()} onValueChange={(value) => handlePlaybackRateChange(parseFloat(value))}>
                  <SelectTrigger className="w-20 h-8 text-xs bg-[#2a2a2a] border-[#3a3a3a]">
                    <SelectValue>{playbackRate}x</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a2a2a] border-[#3a3a3a]">
                    {playbackSpeeds.map((speed) => (
                      <SelectItem key={speed} value={speed.toString()} className="text-xs">
                        {speed}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Tools Panel */}
        <div className="w-64 border-l border-[#2a2a2a] bg-[#1a1a1a] overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="w-full bg-[#2a2a2a] p-1">
              <TabsTrigger value="playback" className="flex-1 text-xs">
                <Play className="w-3 h-3 mr-1" />
                Play
              </TabsTrigger>
              <TabsTrigger value="effects" className="flex-1 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                Effects
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1 text-xs">
                <Type className="w-3 h-3 mr-1" />
                Text
              </TabsTrigger>
            </TabsList>

            {/* Playback Controls Tab */}
            <TabsContent value="playback" className="p-3 space-y-3">
              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Playback Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#888888]">Current Time:</span>
                    <span className="text-white">{formatTime(currentTime)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#888888]">Duration:</span>
                    <span className="text-white">{formatTime(duration)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#888888]">Progress:</span>
                    <span className="text-white">{duration > 0 ? Math.round((currentTime / duration) * 100) : 0}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#888888]">Speed:</span>
                    <span className="text-white">{playbackRate}x</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Video Effects Tab */}
            <TabsContent value="effects" className="p-3 space-y-3">
              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Visual Effects</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Brightness</Label>
                    <Slider
                      value={[videoSettings.brightness]}
                      onValueChange={(value) => updateVideoSetting('brightness', value[0])}
                      min={0}
                      max={200}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{videoSettings.brightness}%</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Contrast</Label>
                    <Slider
                      value={[videoSettings.contrast]}
                      onValueChange={(value) => updateVideoSetting('contrast', value[0])}
                      min={0}
                      max={200}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{videoSettings.contrast}%</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Saturation</Label>
                    <Slider
                      value={[videoSettings.saturation]}
                      onValueChange={(value) => updateVideoSetting('saturation', value[0])}
                      min={0}
                      max={200}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{videoSettings.saturation}%</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Hue</Label>
                    <Slider
                      value={[videoSettings.hue]}
                      onValueChange={(value) => updateVideoSetting('hue', value[0])}
                      min={-180}
                      max={180}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{videoSettings.hue}°</span>
                  </div>
                  
                  <Separator className="bg-[#3a3a3a]" />
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Blur</Label>
                    <Slider
                      value={[videoSettings.blur]}
                      onValueChange={(value) => updateVideoSetting('blur', value[0])}
                      min={0}
                      max={10}
                      step={0.1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{videoSettings.blur}px</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Sepia</Label>
                    <Slider
                      value={[videoSettings.sepia]}
                      onValueChange={(value) => updateVideoSetting('sepia', value[0])}
                      min={0}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{videoSettings.sepia}%</span>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Grayscale</Label>
                    <Slider
                      value={[videoSettings.grayscale]}
                      onValueChange={(value) => updateVideoSetting('grayscale', value[0])}
                      min={0}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                    <span className="text-xs text-[#888888]">{videoSettings.grayscale}%</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetVideoSettings}
                    className="w-full border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#2a2a2a]"
                  >
                    Reset Effects
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Text Overlays Tab */}
            <TabsContent value="text" className="p-3 space-y-3">
              <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Add Text Overlay</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-[#e0e0e0]">Text</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        placeholder="Enter text..."
                        className="bg-[#3a3a3a] border-[#4a4a4a] text-white placeholder-[#888888]"
                        onKeyDown={(e) => e.key === 'Enter' && addTextOverlay()}
                      />
                      <Button
                        onClick={addTextOverlay}
                        size="sm"
                        disabled={!newText.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Text Overlay List */}
              {textOverlays.length > 0 && (
                <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white">Text Overlays</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {textOverlays.map(overlay => (
                      <div
                        key={overlay.id}
                        className={`p-2 rounded border cursor-pointer ${
                          selectedTextId === overlay.id 
                            ? 'border-blue-500 bg-[#3a3a3a]' 
                            : 'border-[#4a4a4a] bg-[#333333]'
                        }`}
                        onClick={() => setSelectedTextId(overlay.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white truncate">
                            {overlay.text}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTextOverlay(overlay.id, { visible: !overlay.visible });
                              }}
                              className="w-6 h-6 p-0"
                            >
                              {overlay.visible ? 
                                <Eye className="w-3 h-3" /> : 
                                <EyeOff className="w-3 h-3" />
                              }
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTextOverlay(overlay.id);
                              }}
                              className="w-6 h-6 p-0 text-red-400 hover:text-red-300"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-[#888888] mt-1">
                          {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Selected Text Properties */}
              {selectedTextId && (
                <Card className="bg-[#2a2a2a] border-[#3a3a3a]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white">Text Properties</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(() => {
                      const selectedOverlay = textOverlays.find(t => t.id === selectedTextId);
                      if (!selectedOverlay) return null;
                      
                      return (
                        <>
                          <div>
                            <Label className="text-xs text-[#e0e0e0]">Font Size</Label>
                            <Slider
                              value={[selectedOverlay.fontSize]}
                              onValueChange={(value) => updateTextOverlay(selectedTextId, { fontSize: value[0] })}
                              min={12}
                              max={72}
                              step={1}
                              className="mt-2"
                            />
                            <span className="text-xs text-[#888888]">{selectedOverlay.fontSize}px</span>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-[#e0e0e0]">Start Time</Label>
                            <Slider
                              value={[selectedOverlay.startTime]}
                              onValueChange={(value) => updateTextOverlay(selectedTextId, { startTime: value[0] })}
                              min={0}
                              max={duration}
                              step={0.1}
                              className="mt-2"
                            />
                            <span className="text-xs text-[#888888]">{formatTime(selectedOverlay.startTime)}</span>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-[#e0e0e0]">End Time</Label>
                            <Slider
                              value={[selectedOverlay.endTime]}
                              onValueChange={(value) => updateTextOverlay(selectedTextId, { endTime: value[0] })}
                              min={selectedOverlay.startTime}
                              max={duration}
                              step={0.1}
                              className="mt-2"
                            />
                            <span className="text-xs text-[#888888]">{formatTime(selectedOverlay.endTime)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}