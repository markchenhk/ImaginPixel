import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Settings, Eye, EyeOff, RefreshCw, Search, Loader2, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getActiveModel, getModelDisplayName } from '@/lib/openrouter';
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
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [hasValidSavedKey, setHasValidSavedKey] = useState(false);
  const [modelPriorities, setModelPriorities] = useState<{
    model: string;
    priority: number;
    enabled: boolean;
  }[]>([]);

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
    queryKey: ['/api/models', openrouterApiKey],
    queryFn: async () => {
      if (!openrouterApiKey || openrouterApiKey === '***hidden***') {
        throw new Error('No OpenRouter API key provided');
      }
      const response = await fetch(`/api/models?apiKey=${encodeURIComponent(openrouterApiKey)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch models');
      }
      return response.json();
    },
    enabled: shouldFetchModels && (hasValidSavedKey || (!!openrouterApiKey && openrouterApiKey !== '***hidden***')),
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
      // Invalidate and refetch the model config to update all displays immediately
      queryClient.invalidateQueries({ queryKey: ['/api/model-config'] });
      queryClient.refetchQueries({ queryKey: ['/api/model-config'] });
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
      // Initialize model priorities from config or set defaults
      if (config.modelPriorities && config.modelPriorities.length > 0) {
        setModelPriorities(config.modelPriorities);
      } else {
        // Set default fallback models if none configured
        setModelPriorities([
          { model: 'google/gemini-2.5-flash-image', priority: 1, enabled: true },
          { model: 'openai/gpt-4o', priority: 2, enabled: true },
          { model: 'anthropic/claude-3.5-sonnet', priority: 3, enabled: false },
        ]);
      }
      
      // Don't set actual API keys for security, but show if configured
      if (config.apiKey) {
        setOpenrouterApiKey('***hidden***');
        setHasValidSavedKey(true);
        setShouldFetchModels(true); // Enable fetching if API key exists
      }
      
      // Check if using a custom model (check if it's not one of the common predefined models)
      const commonModels = ['google/gemini-2.5-flash-image', 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro-vision'];
      const isCustom = config.selectedModel && !commonModels.includes(config.selectedModel);
      if (isCustom) {
        setUseCustomModel(true);
        setCustomModelName(config.selectedModel);
      }
    }
  }, [config]);

  // Update localConfig when modelPriorities change to immediately reflect the active model
  useEffect(() => {
    if (modelPriorities.length > 0 && !useCustomModel) {
      const activeModel = getActiveModel({ ...localConfig, modelPriorities });
      setLocalConfig(prev => ({
        ...prev,
        selectedModel: activeModel
      }));
    }
  }, [modelPriorities, useCustomModel]);

  // Handle OpenRouter API key test and model fetching
  const testOpenRouterApiKey = async (key: string) => {
    if (!key || key === '***hidden***') return;
    
    setIsLoadingModels(true);
    try {
      // Test the API key first
      const response = await fetch(`/api/models?apiKey=${encodeURIComponent(key)}`);
      const data = await response.json();
      
      if (response.ok && data.apiKeyValid) {
        setHasValidSavedKey(false); // Clear saved key status since we're testing a new one
        setShouldFetchModels(true);
        toast({
          title: 'OpenRouter API key valid',
          description: `Found ${data.total} available models`,
        });
      } else {
        throw new Error(data.message || 'Invalid OpenRouter API key');
      }
    } catch (error) {
      setShouldFetchModels(false);
      setHasValidSavedKey(false);
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

  // Model priority management functions
  const moveModelUp = (index: number) => {
    if (index === 0) return;
    const newPriorities = [...modelPriorities];
    // Swap the model with the one above it
    [newPriorities[index - 1], newPriorities[index]] = [newPriorities[index], newPriorities[index - 1]];
    // Update their priority numbers
    newPriorities[index - 1].priority = index;
    newPriorities[index].priority = index + 1;
    setModelPriorities(newPriorities);
  };

  const moveModelDown = (index: number) => {
    if (index === modelPriorities.length - 1) return;
    const newPriorities = [...modelPriorities];
    // Swap the model with the one below it
    [newPriorities[index], newPriorities[index + 1]] = [newPriorities[index + 1], newPriorities[index]];
    // Update their priority numbers
    newPriorities[index].priority = index + 1;
    newPriorities[index + 1].priority = index + 2;
    setModelPriorities(newPriorities);
  };

  const toggleModelEnabled = (index: number) => {
    const newPriorities = [...modelPriorities];
    newPriorities[index].enabled = !newPriorities[index].enabled;
    setModelPriorities(newPriorities);
  };

  const removeModel = (index: number) => {
    const newPriorities = modelPriorities.filter((_, i) => i !== index);
    // Update priority numbers
    newPriorities.forEach((item, i) => {
      item.priority = i + 1;
    });
    setModelPriorities(newPriorities);
  };

  const addModelToSequence = (modelId: string) => {
    // Check if model is already in the sequence
    if (modelPriorities.some(item => item.model === modelId)) {
      toast({
        title: 'Model already added',
        description: 'This model is already in the failover sequence.',
        variant: 'destructive',
      });
      return;
    }
    
    const newPriority = {
      model: modelId,
      priority: modelPriorities.length + 1,
      enabled: true,
    };
    setModelPriorities([...modelPriorities, newPriority]);
  };

  const handleSave = () => {
    const configToSave = { ...localConfig, modelPriorities };
    
    // Handle custom model selection
    if (useCustomModel && customModelName) {
      configToSave.selectedModel = customModelName;
    } else {
      // Update selectedModel to match the active model from priority system
      configToSave.selectedModel = getActiveModel({ ...localConfig, modelPriorities });
    }
    
    // Handle OpenRouter API key saving
    if (openrouterApiKey && openrouterApiKey !== '***hidden***') {
      // New OpenRouter API key provided
      configToSave.apiKey = openrouterApiKey;
      configToSave.apiKeyConfigured = 'true';
    } else if (openrouterApiKey === '***hidden***') {
      // Keep existing OpenRouter API key (don't overwrite)
      configToSave.apiKeyConfigured = 'true';
      // Don't set apiKey field to let backend preserve existing key
    }
    
    
    console.log('Saving configuration:', configToSave);
    updateConfigMutation.mutate(configToSave);
  };

  const handleReset = () => {
    const defaultConfig = {
      selectedModel: 'google/gemini-2.5-flash-image',
      outputQuality: 'high',
      maxResolution: 2048,
      timeout: 120,
      apiKey: null,
      apiKeyConfigured: 'false',
    };
    setLocalConfig(defaultConfig);
    setOpenrouterApiKey('');
    updateConfigMutation.mutate(defaultConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" data-testid="model-config-modal">
      <div className="w-full max-w-6xl h-full max-h-[90vh] bg-[#1a1a1a] border border-[#2a2a2a] flex flex-col m-4 rounded-lg overflow-hidden">
        {/* Modal Header */}
        <div className="border-b border-[#2a2a2a] px-8 py-6 flex items-center justify-between bg-[#0f0f0f]">
          <h2 className="text-2xl font-semibold text-white">LLM Model Configuration</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="close-config-button"
            className="text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white"
          >
            <X className="w-5 h-5" />
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
                        value={openrouterApiKey}
                        onChange={(e) => setOpenrouterApiKey(e.target.value)}
                        placeholder="Enter your OpenRouter API key"
                        className="pr-10"
                        data-testid="openrouter-api-key-input"
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
                      onClick={() => testOpenRouterApiKey(openrouterApiKey)}
                      disabled={!openrouterApiKey || isLoadingModels}
                      size="sm"
                      data-testid="test-openrouter-api-key-button"
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
                  (modelsData?.apiKeyValid || hasValidSavedKey)
                    ? 'bg-green-500/10 border-green-500/20' 
                    : 'bg-yellow-500/10 border-yellow-500/20'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    (modelsData?.apiKeyValid || hasValidSavedKey) ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-sm">
                    {(modelsData?.apiKeyValid || hasValidSavedKey)
                      ? `Connected - ${modelsData?.total || 'Loading...'} models available` 
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
                      {(openrouterApiKey && openrouterApiKey !== '***hidden***') || hasValidSavedKey ? 'No models found. Please check your API key.' : 'Enter your API key to load available models'}
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
                      className={`model-card p-3 transition-all hover:shadow-md ${
                        localConfig.selectedModel === model.id && !useCustomModel
                          ? 'border-blue-500 bg-blue-500/5' 
                          : 'hover:border-blue-500/50'
                      }`}
                      data-testid={`model-card-${model.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{model.name}</h4>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            localConfig.selectedModel === model.id ? 'bg-blue-500' : 'bg-gray-400'
                          }`} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              addModelToSequence(model.id);
                            }}
                            className="h-6 px-2 text-xs text-[#ffd700] hover:bg-[#ffd700]/20"
                            data-testid={`add-to-failover-${model.id}`}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {model.description || 'No description available'}
                      </p>
                      <div 
                        className="cursor-pointer"
                        onClick={() => {
                          setUseCustomModel(false);
                          setLocalConfig({ ...localConfig, selectedModel: model.id });
                        }}
                      >
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

            {/* Model Failover Sequence */}
            <div>
              <h3 className="font-medium mb-4 text-white">Model Failover Sequence</h3>
              <p className="text-sm text-[#a0a0a0] mb-4">
                Configure multiple models with priority order. If the primary model fails, the system will automatically try the next enabled model.
              </p>
              
              {/* Current Failover Sequence */}
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-medium text-[#e0e0e0]">Current Sequence</h4>
                
                {modelPriorities.length === 0 ? (
                  <div className="border border-[#3a3a3a] rounded-lg p-4 text-center">
                    <p className="text-sm text-[#888]">No models configured for failover</p>
                    <p className="text-xs text-[#666] mt-1">Add models from the available models list below</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modelPriorities.map((item, index) => (
                      <div
                        key={item.model}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          item.enabled 
                            ? 'border-[#3a3a3a] bg-[#1a1a1a]' 
                            : 'border-[#2a2a2a] bg-[#0f0f0f] opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                            item.enabled ? 'bg-[#ffd700] text-black' : 'bg-[#444] text-[#888]'
                          }`}>
                            {item.priority}
                          </div>
                          <div>
                            <span className={`text-sm font-medium ${
                              item.enabled ? 'text-white' : 'text-[#888]'
                            }`}>
                              {item.model}
                            </span>
                            <div className={`text-xs ${
                              item.enabled ? 'text-[#a0a0a0]' : 'text-[#666]'
                            }`}>
                              {item.enabled ? 'Enabled' : 'Disabled'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveModelUp(index)}
                            disabled={index === 0}
                            className="h-8 w-8 p-0 text-[#e0e0e0] hover:bg-[#2a2a2a]"
                            data-testid={`move-up-${item.model}`}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveModelDown(index)}
                            disabled={index === modelPriorities.length - 1}
                            className="h-8 w-8 p-0 text-[#e0e0e0] hover:bg-[#2a2a2a]"
                            data-testid={`move-down-${item.model}`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleModelEnabled(index)}
                            className={`h-8 w-8 p-0 ${
                              item.enabled 
                                ? 'text-yellow-400 hover:bg-yellow-400/20' 
                                : 'text-green-400 hover:bg-green-400/20'
                            }`}
                            data-testid={`toggle-${item.model}`}
                          >
                            {item.enabled ? '🔕' : '✓'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeModel(index)}
                            className="h-8 w-8 p-0 text-red-400 hover:bg-red-400/20"
                            data-testid={`remove-${item.model}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
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
                      getModelDisplayName(getActiveModel(localConfig))
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                  <span className="text-sm text-muted-foreground">API Key Status</span>
                  <span className="font-medium text-green-400" data-testid="api-key-status">
                    {(modelsData?.apiKeyValid || hasValidSavedKey) ? 'Valid' : openrouterApiKey ? 'Not validated' : 'Not provided'}
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

      {/* Modal Footer */}
      <div className="border-t border-[#2a2a2a] p-8 bg-[#0f0f0f]">
        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={updateConfigMutation.isPending}
            data-testid="reset-config-button"
            className="border-[#3a3a3a] text-[#e0e0e0] hover:bg-[#2a2a2a]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateConfigMutation.isPending}
            className="bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-semibold"
            data-testid="save-config-button"
          >
            {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>
    </div>
  </div>
  );
}
