import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Settings, Eye, EyeOff, RefreshCw, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ModelConfiguration } from '@shared/schema';
import type { OpenRouterModel } from '@/types';

interface ModelConfigProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModelConfig({ isOpen, onClose }: ModelConfigProps) {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<ModelConfiguration>>({});
  const [apiKey, setApiKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);

  // Fetch current configuration
  const { data: config, isLoading } = useQuery<ModelConfiguration>({
    queryKey: ['/api/model-config'],
  });

  // Fetch available models from OpenRouter  
  const [shouldFetchModels, setShouldFetchModels] = useState(false);
  
  const { data: modelsData, isLoading: modelsLoading, refetch: refetchModels } = useQuery<{
    data: OpenRouterModel[];
    total: number;
    apiKeyValid: boolean;
  }>({
    queryKey: ['/api/models', apiKey],
    queryFn: async () => {
      if (!apiKey || apiKey === '***hidden***') {
        throw new Error('No API key provided');
      }
      const response = await fetch(`/api/models?apiKey=${encodeURIComponent(apiKey)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch models');
      }
      return response.json();
    },
    enabled: shouldFetchModels && !!apiKey && apiKey !== '***hidden***',
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation<ModelConfiguration, Error, Partial<ModelConfiguration>>({
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
      // Don't set actual API key for security, but show if configured
      if (config.apiKey) {
        setApiKey('***hidden***');
        setShouldFetchModels(true); // Enable fetching if API key exists
      }
      
      // Check if using a custom model (check if it's not one of the common predefined models)
      const commonModels = ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro-vision'];
      const isCustom = config.selectedModel && !commonModels.includes(config.selectedModel);
      if (isCustom) {
        setUseCustomModel(true);
        setCustomModelName(config.selectedModel);
      }
    }
  }, [config]);

  // Handle API key test and model fetching
  const testApiKey = async (key: string) => {
    if (!key || key === '***hidden***') return;
    
    setIsLoadingModels(true);
    try {
      // Test the API key first
      const response = await fetch(`/api/models?apiKey=${encodeURIComponent(key)}`);
      const data = await response.json();
      
      if (response.ok && data.apiKeyValid) {
        setShouldFetchModels(true);
        toast({
          title: 'API key valid',
          description: `Found ${data.total} available models`,
        });
      } else {
        throw new Error(data.message || 'Invalid API key');
      }
    } catch (error) {
      setShouldFetchModels(false);
      toast({
        title: 'API key test failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Filter models based on search query
  const filteredModels = modelsData?.data?.filter(model => 
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleSave = () => {
    const configToSave = { ...localConfig };
    
    // Only include API key if it's been changed (not the hidden placeholder)
    if (apiKey && apiKey !== '***hidden***') {
      configToSave.apiKey = apiKey;
      configToSave.apiKeyConfigured = 'true';
    }
    
    updateConfigMutation.mutate(configToSave);
  };

  const handleReset = () => {
    const defaultConfig = {
      selectedModel: 'openai/gpt-4o',
      outputQuality: 'high',
      maxResolution: 2048,
      timeout: 120,
      apiKey: null,
      apiKeyConfigured: 'false',
    };
    setLocalConfig(defaultConfig);
    setApiKey('');
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
            {/* API Configuration */}
            <div>
              <h3 className="font-medium mb-3">OpenRouter API Key</h3>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    API Key
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your OpenRouter API key"
                        className="pr-10"
                        data-testid="api-key-input"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                        onClick={() => setShowApiKey(!showApiKey)}
                        data-testid="toggle-api-key-visibility"
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      onClick={() => testApiKey(apiKey)}
                      disabled={!apiKey || isLoadingModels}
                      size="sm"
                      data-testid="test-api-key-button"
                    >
                      {isLoadingModels ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Test'
                      )}
                    </Button>
                  </div>
                </div>

                <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                  modelsData?.apiKeyValid
                    ? 'bg-green-500/10 border-green-500/20' 
                    : 'bg-yellow-500/10 border-yellow-500/20'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    modelsData?.apiKeyValid ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-sm">
                    {modelsData?.apiKeyValid
                      ? `Connected - ${modelsData.total} models available` 
                      : 'API key not validated'}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a 
                    href="https://openrouter.ai/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    OpenRouter Dashboard
                  </a>
                </p>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Available Models</h3>
                {modelsData?.data && (
                  <span className="text-xs text-muted-foreground">
                    {filteredModels.length} of {modelsData.total}
                  </span>
                )}
              </div>
              
              {/* Search Models */}
              {modelsData?.data && modelsData.data.length > 0 && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="model-search-input"
                  />
                </div>
              )}
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {modelsLoading ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Loading models...</p>
                  </div>
                ) : !modelsData?.data || modelsData.data.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      {apiKey ? 'No models found. Please check your API key.' : 'Enter your API key to load available models'}
                    </p>
                  </div>
                ) : filteredModels.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      No models match your search
                    </p>
                  </div>
                ) : (
                  filteredModels.map((model) => (
                    <Card
                      key={model.id}
                      className={`model-card p-3 cursor-pointer transition-all hover:shadow-md ${
                        localConfig.selectedModel === model.id && !useCustomModel
                          ? 'border-blue-500 bg-blue-500/5' 
                          : 'hover:border-blue-500/50'
                      }`}
                      onClick={() => {
                        setUseCustomModel(false);
                        setLocalConfig({ ...localConfig, selectedModel: model.id });
                      }}
                      data-testid={`model-card-${model.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{model.name}</h4>
                        <div className={`w-2 h-2 rounded-full ${
                          localConfig.selectedModel === model.id ? 'bg-blue-500' : 'bg-gray-400'
                        }`} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {model.description || 'No description available'}
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          ${parseFloat(model.pricing?.prompt || '0').toFixed(3)}/1K tokens
                        </span>
                        {localConfig.selectedModel === model.id && !useCustomModel && (
                          <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Context: {model.context_length?.toLocaleString() || 'N/A'} tokens
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Custom Model Input */}
            <div>
              <h3 className="font-medium mb-3">Custom Model</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use-custom-model"
                    checked={useCustomModel}
                    onChange={(e) => {
                      setUseCustomModel(e.target.checked);
                      if (e.target.checked && customModelName) {
                        setLocalConfig({ ...localConfig, selectedModel: customModelName });
                      }
                    }}
                    className="rounded"
                    data-testid="use-custom-model-checkbox"
                  />
                  <Label htmlFor="use-custom-model" className="text-sm">
                    Use custom model name
                  </Label>
                </div>
                
                {useCustomModel && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Model Name
                    </Label>
                    <Input
                      placeholder="e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet"
                      value={customModelName}
                      onChange={(e) => {
                        setCustomModelName(e.target.value);
                        setLocalConfig({ ...localConfig, selectedModel: e.target.value });
                      }}
                      className="mt-2"
                      data-testid="custom-model-input"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the exact model ID from OpenRouter (e.g., openai/gpt-4o)
                    </p>
                  </div>
                )}
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

            {/* Current Configuration */}
            <div>
              <h3 className="font-medium mb-3">Current Selection</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Selected Model</span>
                  <span className="font-medium text-right" data-testid="current-model">
                    {useCustomModel ? (
                      <span className="text-orange-400">Custom: {customModelName || 'None'}</span>
                    ) : (
                      localConfig.selectedModel || 'None'
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">API Key Status</span>
                  <span className="font-medium text-green-400" data-testid="api-key-status">
                    {modelsData?.apiKeyValid ? 'Valid' : apiKey ? 'Not validated' : 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">Available Models</span>
                  <span className="font-medium" data-testid="available-models-count">
                    {modelsData?.total || 0}
                  </span>
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
