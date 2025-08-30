import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Settings, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { AVAILABLE_MODELS, getModelDisplayName, getModelPricing } from '@/lib/openrouter';
import type { ModelConfiguration } from '@shared/schema';

interface ModelConfigProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModelConfig({ isOpen, onClose }: ModelConfigProps) {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<ModelConfiguration>>({});

  // Fetch current configuration
  const { data: config, isLoading } = useQuery({
    queryKey: ['/api/model-config'],
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: Partial<ModelConfiguration>) => {
      const response = await apiRequest('POST', '/api/model-config', newConfig);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/model-config'] });
      toast({
        title: 'Configuration updated',
        description: 'Your model settings have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Initialize local config when config is loaded
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleSave = () => {
    updateConfigMutation.mutate(localConfig);
  };

  const handleReset = () => {
    const defaultConfig = {
      selectedModel: 'openai/gpt-4o',
      outputQuality: 'high',
      maxResolution: 2048,
      timeout: 120,
    };
    setLocalConfig(defaultConfig);
    updateConfigMutation.mutate(defaultConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col" data-testid="model-config-sidebar">
      {/* Sidebar Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h2 className="font-medium">Model Configuration</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          data-testid="close-config-button"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Configuration Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="text-center">
            <div className="processing-animation w-8 h-8 rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Loading configuration...</p>
          </div>
        ) : (
          <>
            {/* API Configuration Status */}
            <div>
              <h3 className="font-medium mb-3">OpenRouter API</h3>
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                config?.apiKeyConfigured === 'true' 
                  ? 'bg-green-500/10 border-green-500/20' 
                  : 'bg-yellow-500/10 border-yellow-500/20'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  config?.apiKeyConfigured === 'true' ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="text-sm">
                  {config?.apiKeyConfigured === 'true' 
                    ? 'Connected to OpenRouter' 
                    : 'API key not configured'}
                </span>
              </div>
              
              {config?.apiKeyConfigured !== 'true' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Set the OPENROUTER_API_KEY environment variable to enable AI processing
                </p>
              )}
            </div>

            {/* Model Selection */}
            <div>
              <h3 className="font-medium mb-3">Available Models</h3>
              <div className="space-y-2">
                {Object.entries(AVAILABLE_MODELS).map(([modelId, model]) => (
                  <Card
                    key={modelId}
                    className={`model-card p-3 cursor-pointer transition-all hover:shadow-md ${
                      localConfig.selectedModel === modelId 
                        ? 'border-blue-500 bg-blue-500/5' 
                        : 'hover:border-blue-500/50'
                    }`}
                    onClick={() => setLocalConfig({ ...localConfig, selectedModel: modelId })}
                    data-testid={`model-card-${modelId}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{model.name}</h4>
                      <div className={`w-2 h-2 rounded-full ${
                        localConfig.selectedModel === modelId ? 'bg-blue-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {model.description}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {getModelPricing(modelId)}
                      </span>
                      {localConfig.selectedModel === modelId && (
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Processing Options */}
            <div>
              <h3 className="font-medium mb-3">Processing Options</h3>
              <div className="space-y-4">
                {/* Output Quality */}
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Output Quality
                  </Label>
                  <Select
                    value={localConfig.outputQuality || 'high'}
                    onValueChange={(value) => setLocalConfig({ ...localConfig, outputQuality: value })}
                  >
                    <SelectTrigger className="mt-2" data-testid="output-quality-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (faster)</SelectItem>
                      <SelectItem value="high">High Quality</SelectItem>
                      <SelectItem value="ultra">Ultra (slower)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Max Resolution */}
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Max Resolution
                  </Label>
                  <Select
                    value={localConfig.maxResolution?.toString() || '2048'}
                    onValueChange={(value) => setLocalConfig({ ...localConfig, maxResolution: parseInt(value) })}
                  >
                    <SelectTrigger className="mt-2" data-testid="max-resolution-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024">1024×1024</SelectItem>
                      <SelectItem value="2048">2048×2048</SelectItem>
                      <SelectItem value="4096">4096×4096</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Timeout */}
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Timeout (seconds)
                  </Label>
                  <div className="mt-2">
                    <Slider
                      value={[localConfig.timeout || 120]}
                      onValueChange={([value]) => setLocalConfig({ ...localConfig, timeout: value })}
                      min={30}
                      max={300}
                      step={10}
                      className="w-full"
                      data-testid="timeout-slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>30s</span>
                      <span data-testid="timeout-value">{localConfig.timeout || 120}s</span>
                      <span>300s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Statistics */}
            <div>
              <h3 className="font-medium mb-3">Usage Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Images Processed Today</span>
                  <span className="font-medium" data-testid="daily-usage">0</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">API Credits Status</span>
                  <span className="font-medium text-green-400" data-testid="credits-status">
                    {config?.apiKeyConfigured === 'true' ? 'Active' : 'Not configured'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Avg. Processing Time</span>
                  <span className="font-medium" data-testid="avg-processing-time">N/A</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-border p-6 space-y-3">
        <Button
          onClick={handleSave}
          disabled={updateConfigMutation.isPending}
          className="w-full"
          data-testid="save-config-button"
        >
          {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </Button>
        
        <Button
          variant="destructive"
          onClick={handleReset}
          disabled={updateConfigMutation.isPending}
          className="w-full"
          data-testid="reset-config-button"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
