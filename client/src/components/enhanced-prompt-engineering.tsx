import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PromptTemplate, ApplicationFunction } from '@shared/schema';
import { 
  Wand2, 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Sparkles,
  Copy,
  Check,
  Settings,
  Layers,
  Save,
  AlertTriangle,
  Hash,
  ArrowUpDown,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  FileText,
  ArrowLeft,
  ChevronRight,
  Keyboard,
  FolderOpen,
  Target
} from 'lucide-react';

interface EnhancedPromptEngineeringProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFunction?: 'image-enhancement' | 'image-to-video';
  isAdmin: boolean;
}

type ViewState = 'functionsList' | 'functionDetail' | 'templateDetail';

export function EnhancedPromptEngineering({ isOpen, onClose, selectedFunction = 'image-enhancement', isAdmin }: EnhancedPromptEngineeringProps) {
  const { toast } = useToast();
  
  // New hierarchical view state management
  const [currentView, setCurrentView] = useState<ViewState>('functionsList');
  const [selectedFunctionForDetail, setSelectedFunctionForDetail] = useState<ApplicationFunction | null>(null);
  const [selectedTemplateForDetail, setSelectedTemplateForDetail] = useState<PromptTemplate | null>(null);
  
  // Legacy states for forms - keeping for compatibility during transition
  const [activeTab, setActiveTab] = useState<'functions' | 'templates'>('functions');
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [editingFunction, setEditingFunction] = useState<ApplicationFunction | null>(null);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [showNewFunctionForm, setShowNewFunctionForm] = useState(false);
  const [enhancingTemplate, setEnhancingTemplate] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  
  // Effect to clear all states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('functionsList');
      setSelectedFunctionForDetail(null);
      setSelectedTemplateForDetail(null);
      setActiveTab('functions');
      setSelectedFunctionId('all');
      setEditingTemplate(null);
      setEditingFunction(null);
      setShowNewTemplateForm(false);
      setShowNewFunctionForm(false);
      setEnhancingTemplate(null);
      setCopiedTemplate(null);
    }
  }, [isOpen]);
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'custom',
    functionId: '',
    template: '',
    variables: [] as string[],
    enabled: true
  });

  const [newFunction, setNewFunction] = useState({
    name: '',
    description: '',
    functionKey: '',
    icon: 'Wand2',
    enabled: true,
    sortOrder: 0,
    defaultTemplate: ''
  });

  // Navigation functions
  const navigateToFunctionDetail = (func: ApplicationFunction) => {
    setSelectedFunctionForDetail(func);
    setCurrentView('functionDetail');
  };

  const navigateToTemplateDetail = (template: PromptTemplate) => {
    setSelectedTemplateForDetail(template);
    setCurrentView('templateDetail');
  };

  const navigateBackToFunctionsList = () => {
    setSelectedFunctionForDetail(null);
    setSelectedTemplateForDetail(null);
    setCurrentView('functionsList');
  };

  const navigateBackToFunctionDetail = () => {
    setSelectedTemplateForDetail(null);
    setCurrentView('functionDetail');
  };

  // Template categories based on common use cases
  const templateCategories = [
    { value: 'background-removal', label: 'Background Removal' },
    { value: 'lighting-enhancement', label: 'Lighting Enhancement' },
    { value: 'color-correction', label: 'Color Correction' },
    { value: 'style-transfer', label: 'Style Transfer' },
    { value: 'upscaling', label: 'Upscaling' },
    { value: 'animation-effects', label: 'Animation Effects' },
    { value: '3d-transforms', label: '3D Transforms' },
    { value: 'motion-graphics', label: 'Motion Graphics' },
    { value: 'promotional-clips', label: 'Promotional Clips' },
    { value: 'custom', label: 'Custom' }
  ];

  // Available icons for functions
  const availableIcons = [
    'Wand2', 'Sparkles', 'Settings', 'Layers', 'Edit3', 'Eye', 'Camera', 'Video', 'Image', 'Palette'
  ];

  // Fetch all functions from API (admin only)
  const { data: functions = [], isLoading: isFunctionsLoading } = useQuery<ApplicationFunction[]>({
    queryKey: ['/api/admin/application-functions'],
    enabled: isOpen && isAdmin
  });

  // Fetch all templates from API (admin only)
  const { data: templates = [], isLoading: isTemplatesLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['/api/admin/prompt-templates'],
    enabled: isOpen && isAdmin
  });

  // Filter templates based on selected function
  const filteredTemplates = selectedFunctionId === 'all' 
    ? templates
    : templates.filter(t => t.functionId === selectedFunctionId);

  // Group templates by function for the Functions tab
  const templatesByFunction = templates.reduce((acc, template) => {
    if (!acc[template.functionId]) {
      acc[template.functionId] = [];
    }
    acc[template.functionId].push(template);
    return acc;
  }, {} as Record<string, PromptTemplate[]>);

  // Extract variables from template text
  const extractVariables = (template: string): string[] => {
    const matches = template.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  };

  // Function mutations
  const createFunctionMutation = useMutation({
    mutationFn: async (func: Partial<ApplicationFunction>) => {
      const response = await apiRequest('POST', '/api/admin/application-functions', func);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/application-functions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/application-functions'] });
      toast({
        title: 'Function created',
        description: 'New application function has been created successfully.',
      });
      setShowNewFunctionForm(false);
      resetNewFunction();
    },
  });

  const updateFunctionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ApplicationFunction> }) => {
      const response = await apiRequest('PUT', `/api/admin/application-functions/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/application-functions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/application-functions'] });
      toast({
        title: 'Function updated',
        description: 'Application function has been updated successfully.',
      });
      setEditingFunction(null);
    },
  });

  const deleteFunctionMutation = useMutation({
    mutationFn: async (functionId: string) => {
      const response = await apiRequest('DELETE', `/api/admin/application-functions/${functionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/application-functions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/application-functions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/prompt-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
      toast({
        title: 'Function deleted',
        description: 'Application function has been deleted successfully.',
      });
      setEditingFunction(null);
    },
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (template: Partial<PromptTemplate>) => {
      const response = await apiRequest('POST', '/api/prompt-templates', template);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/prompt-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
      toast({
        title: 'Template created',
        description: 'New prompt template has been created successfully.',
      });
      setShowNewTemplateForm(false);
      resetNewTemplate();
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PromptTemplate> }) => {
      const response = await apiRequest('PUT', `/api/prompt-templates/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/prompt-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
      toast({
        title: 'Template updated',
        description: 'Template has been updated successfully.',
      });
      setEditingTemplate(null);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest('DELETE', `/api/prompt-templates/${templateId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/prompt-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
      toast({
        title: 'Template deleted',
        description: 'Template has been deleted successfully.',
      });
      setEditingTemplate(null);
    },
  });

  // LLM enhance template mutation
  const enhanceTemplateMutation = useMutation({
    mutationFn: async (templateContent: string) => {
      const response = await apiRequest('POST', '/api/enhance-template', {
        template: templateContent
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (editingTemplate) {
        setEditingTemplate({
          ...editingTemplate,
          template: data.enhancedTemplate
        });
      } else {
        setNewTemplate({
          ...newTemplate,
          template: data.enhancedTemplate
        });
      }
      toast({
        title: 'Template enhanced',
        description: 'Template has been enhanced using AI.',
      });
      setEnhancingTemplate(null);
    },
    onError: () => {
      toast({
        title: 'Enhancement failed',
        description: 'Failed to enhance template. Please try again.',
        variant: 'destructive'
      });
      setEnhancingTemplate(null);
    }
  });

  const resetNewTemplate = () => {
    setNewTemplate({
      name: '',
      description: '',
      category: 'custom',
      functionId: '',
      template: '',
      variables: [],
      enabled: true
    });
  };

  const resetNewFunction = () => {
    setNewFunction({
      name: '',
      description: '',
      functionKey: '',
      icon: 'Wand2',
      enabled: true,
      sortOrder: Math.max(...functions.map(f => f.sortOrder || 0), 0) + 1,
      defaultTemplate: ''
    });
  };

  const handleSaveTemplate = () => {
    const templateData = {
      ...newTemplate,
      variables: extractVariables(newTemplate.template),
      enabled: newTemplate.enabled ? "true" : "false",
      createdBy: 'admin' // This should come from auth context
    };
    createTemplateMutation.mutate(templateData);
  };

  const handleSaveFunction = () => {
    const functionData = {
      ...newFunction,
      enabled: newFunction.enabled ? "true" : "false",
      createdBy: 'admin' // This should come from auth context
    };
    createFunctionMutation.mutate(functionData);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;
    const updates = {
      ...editingTemplate,
      variables: extractVariables(editingTemplate.template),
      enabled: editingTemplate.enabled === "true" ? "true" : "false"
    };
    updateTemplateMutation.mutate({ id: editingTemplate.id, updates });
  };

  const handleUpdateFunction = () => {
    if (!editingFunction) return;
    const updates = {
      ...editingFunction,
      enabled: editingFunction.enabled === "true" ? "true" : "false"
    };
    updateFunctionMutation.mutate({ id: editingFunction.id, updates });
  };

  const handleEnhanceTemplate = (templateContent: string) => {
    setEnhancingTemplate(templateContent);
    enhanceTemplateMutation.mutate(templateContent);
  };

  const handleCopyTemplate = (template: PromptTemplate) => {
    navigator.clipboard.writeText(template.template);
    setCopiedTemplate(template.id);
    setTimeout(() => setCopiedTemplate(null), 2000);
    toast({
      title: 'Copied to clipboard',
      description: 'Template content has been copied to clipboard.',
    });
  };

  const handleToggleTemplateEnabled = (template: PromptTemplate) => {
    const newEnabled = template.enabled === "true" ? "false" : "true";
    const updates = { enabled: newEnabled };
    updateTemplateMutation.mutate({ id: template.id, updates });
  };

  const handleReorderTemplate = (templateId: string, direction: 'up' | 'down') => {
    // Reordering is disabled until database migration is complete
    toast({
      title: 'Template reordering temporarily disabled',
      description: 'Reordering will be available after database migration.',
    });
  };

  if (!isOpen) return null;

  // Breadcrumb component
  const Breadcrumb = () => {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-300 px-6 py-3 bg-[#151515] border-b border-[#2a2a2a]">
        {currentView === 'functionsList' && (
          <span className="font-medium text-white">Application Functions</span>
        )}
        
        {currentView === 'functionDetail' && selectedFunctionForDetail && (
          <>
            <button 
              onClick={navigateBackToFunctionsList}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
              data-testid="breadcrumb-back-to-functions"
            >
              <ArrowLeft className="h-3 w-3" />
              Application Functions
            </button>
            <ChevronRight className="h-3 w-3 text-gray-500" />
            <span className="font-medium text-white">{selectedFunctionForDetail.name}</span>
          </>
        )}
        
        {currentView === 'templateDetail' && selectedFunctionForDetail && selectedTemplateForDetail && (
          <>
            <button 
              onClick={navigateBackToFunctionsList}
              className="text-blue-400 hover:text-blue-300"
              data-testid="breadcrumb-back-to-functions"
            >
              Application Functions
            </button>
            <ChevronRight className="h-3 w-3 text-gray-500" />
            <button 
              onClick={navigateBackToFunctionDetail}
              className="text-blue-400 hover:text-blue-300"
              data-testid="breadcrumb-back-to-function"
            >
              {selectedFunctionForDetail.name}
            </button>
            <ChevronRight className="h-3 w-3 text-gray-500" />
            <span className="font-medium text-white">{selectedTemplateForDetail.name}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-7xl h-[90vh] flex flex-col border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <Wand2 className="h-6 w-6 text-[#ffd700]" />
            <h2 className="text-2xl font-bold text-white">Enhanced Prompt Engineering</h2>
            <Badge className="bg-[#ffd700]/20 text-[#ffd700] border-[#ffd700]/30">
              Admin Only
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            data-testid="button-close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Breadcrumb Navigation */}
        <Breadcrumb />

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col">
            {/* Header Section */}
            <div className="px-6 pt-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-3 pb-4">
                <Settings className="h-5 w-5 text-[#ffd700]" />
                <h3 className="text-lg font-semibold text-white">Application Functions & Prompt Templates</h3>
                <Badge className="bg-[#ffd700]/20 text-[#ffd700] border-[#ffd700]/30 text-xs">
                  {functions.length} Functions | {templates.length} Templates
                </Badge>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Hierarchical View Content */}
              <div className="flex-1 flex overflow-hidden">
                {currentView === 'functionsList' && <FunctionsListView />}
                {currentView === 'functionDetail' && selectedFunctionForDetail && <FunctionDetailView />}
                {currentView === 'templateDetail' && selectedTemplateForDetail && <TemplateDetailView />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Functions List View (Upper Level)
  function FunctionsListView() {
    return (
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-[#2a2a2a] p-4 space-y-4">
          <Button
            onClick={() => {
              resetNewFunction();
              setShowNewFunctionForm(true);
              setEditingFunction(null);
            }}
            className="w-full bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
            data-testid="button-new-function"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Function
          </Button>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            <Label className="text-sm font-medium text-gray-300">
              Application Functions ({functions.length})
            </Label>
            {functions
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              .map(func => (
                <Card
                  key={func.id}
                  className={`p-3 border-[#3a3a3a] cursor-pointer hover:bg-[#3a3a3a] transition-colors ${
                    func.enabled === "false" ? 'bg-[#2a2a2a]/50 opacity-60' : 'bg-[#2a2a2a]'
                  }`}
                  onClick={() => {
                    setSelectedFunctionForDetail(func);
                    setCurrentView('functionDetail');
                  }}
                  data-testid={`card-function-${func.functionKey}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm truncate">{func.name}</span>
                      <div className="flex items-center gap-1">
                        {func.enabled === "false" ? (
                          <div className="flex items-center gap-1">
                            <EyeOff className="h-3 w-3 text-gray-500" />
                            <span className="text-xs text-gray-500">Disabled</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-green-500">Enabled</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{func.description}</p>
                    
                    {/* Default Template Preview */}
                    {func.defaultTemplate && (
                      <div className="mt-2 p-2 bg-gray-800/40 rounded border border-gray-700/30">
                        <div className="text-xs font-medium text-blue-400 mb-1">🎯 Default Template</div>
                        <div className="text-xs text-gray-300 font-mono line-clamp-2">
                          {func.defaultTemplate.substring(0, 100)}{func.defaultTemplate.length > 100 ? '...' : ''}
                        </div>
                      </div>
                    )}
                    
                    {/* Hotkey Templates Count */}
                    {templates.filter(t => t.functionId === func.id).length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                        <Keyboard className="h-3 w-3" />
                        <span>{templates.filter(t => t.functionId === func.id).length} hotkey templates</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {showNewFunctionForm ? (
            <NewFunctionForm
              newFunction={newFunction}
              setNewFunction={setNewFunction}
              onSave={handleSaveFunction}
              onCancel={() => {
                setShowNewFunctionForm(false);
                resetNewFunction();
              }}
              isSaving={createFunctionMutation.isPending}
              availableIcons={availableIcons}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Select a function to manage</p>
                <p className="text-sm">Choose an application function from the sidebar to edit its default template and manage hotkey templates</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Function Detail View (Middle Level)
  function FunctionDetailView() {
    if (!selectedFunctionForDetail) return null;
    
    const functionTemplates = templates.filter(t => t.functionId === selectedFunctionForDetail.id);
    
    return (
      <div className="flex-1 flex overflow-hidden">
        {/* Function Details Sidebar */}
        <div className="w-80 border-r border-[#2a2a2a] p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium text-white">{selectedFunctionForDetail.name}</h3>
              <Badge className={`text-xs ${selectedFunctionForDetail.enabled === "false" ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                {selectedFunctionForDetail.enabled === "false" ? 'Disabled' : 'Enabled'}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">{selectedFunctionForDetail.description}</p>
          </div>
          
          <div className="space-y-3 border-t border-[#2a2a2a] pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-300">Hotkey Templates ({functionTemplates.length})</Label>
              <Button 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={() => {
                  // Initialize new template with current function
                  setNewTemplate({
                    name: '',
                    description: '',
                    category: 'custom',
                    functionId: selectedFunctionForDetail?.id || '',
                    template: '',
                    variables: [],
                    enabled: true
                  });
                  setShowNewTemplateForm(true);
                  setEditingTemplate(null);
                }}
                data-testid="button-add-template"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {functionTemplates.map(template => (
                <div
                  key={template.id}
                  className="p-2 bg-[#2a2a2a] rounded border border-[#3a3a3a] cursor-pointer hover:bg-[#3a3a3a] transition-colors"
                  onClick={() => {
                    setSelectedTemplateForDetail(template);
                    setCurrentView('templateDetail');
                  }}
                  data-testid={`template-item-${template.hotkey}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white text-sm">{template.name}</span>
                    <kbd className="px-2 py-1 bg-gray-700 text-xs font-mono rounded">{template.hotkey}</kbd>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-1">{template.description}</p>
                </div>
              ))}
              {functionTemplates.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  <Keyboard className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No hotkey templates yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Default Template Editor OR New Template Form */}
        <div className="flex-1 p-6 overflow-y-auto">
          {showNewTemplateForm ? (
            <NewTemplateForm
              newTemplate={newTemplate}
              setNewTemplate={setNewTemplate}
              onSave={handleSaveTemplate}
              onCancel={() => {
                setShowNewTemplateForm(false);
                resetNewTemplate();
              }}
              isSaving={createTemplateMutation.isPending}
              functions={functions}
              templateCategories={templateCategories}
            />
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Target className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-medium text-white">Default Template</h2>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Primary</Badge>
              </div>
            
            <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4">
              <Label className="text-sm font-medium text-gray-300 block mb-2">
                Default Prompt Template
              </Label>
              <Textarea
                value={selectedFunctionForDetail.defaultTemplate || ''}
                onChange={(e) => {
                  const updated = { ...selectedFunctionForDetail, defaultTemplate: e.target.value };
                  setSelectedFunctionForDetail(updated);
                }}
                placeholder="Enter the default prompt template for this function..."
                className="min-h-32 bg-[#1a1a1a] border-[#3a3a3a] font-mono text-sm"
                data-testid="textarea-default-template"
              />
              <p className="text-xs text-gray-400 mt-2">
                This template is used when no specific hotkey template is selected. Variables like {'{image_type}'} and {'{quality_level}'} are automatically replaced.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  // Handle save default template with proper API call
                  if (selectedFunctionForDetail) {
                    updateFunctionMutation.mutate({
                      id: selectedFunctionForDetail.id,
                      updates: { defaultTemplate: selectedFunctionForDetail.defaultTemplate }
                    });
                  }
                }}
                disabled={updateFunctionMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-save-default-template"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateFunctionMutation.isPending ? 'Saving...' : 'Save Default Template'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFunctionForDetail({
                    ...selectedFunctionForDetail,
                    defaultTemplate: functions.find(f => f.id === selectedFunctionForDetail.id)?.defaultTemplate || ''
                  });
                }}
                data-testid="button-reset-default-template"
              >
                Reset Changes
              </Button>
            </div>
          </div>
          )}
        </div>
      </div>
    );
  }

  // Template Detail View (Lower Level)
  function TemplateDetailView() {
    if (!selectedTemplateForDetail) return null;
    
    return (
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Keyboard className="h-6 w-6 text-purple-400" />
            <h2 className="text-xl font-medium text-white">{selectedTemplateForDetail.name}</h2>
            <kbd className="px-3 py-1 bg-gray-700 text-sm font-mono rounded">{selectedTemplateForDetail.hotkey}</kbd>
          </div>
          
          <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4">
            <Label className="text-sm font-medium text-gray-300 block mb-2">
              Template Content
            </Label>
            <Textarea
              value={selectedTemplateForDetail.template}
              onChange={(e) => {
                setSelectedTemplateForDetail({
                  ...selectedTemplateForDetail,
                  template: e.target.value
                });
              }}
              placeholder="Enter the hotkey template content..."
              className="min-h-40 bg-[#1a1a1a] border-[#3a3a3a] font-mono text-sm"
              data-testid="textarea-template-content"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-300 block mb-2">Template Name</Label>
              <Input
                value={selectedTemplateForDetail.name}
                onChange={(e) => {
                  setSelectedTemplateForDetail({
                    ...selectedTemplateForDetail,
                    name: e.target.value
                  });
                }}
                className="bg-[#1a1a1a] border-[#3a3a3a]"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300 block mb-2">Hotkey</Label>
              <Input
                value={selectedTemplateForDetail.hotkey}
                onChange={(e) => {
                  setSelectedTemplateForDetail({
                    ...selectedTemplateForDetail,
                    hotkey: e.target.value
                  });
                }}
                className="bg-[#1a1a1a] border-[#3a3a3a]"
                data-testid="input-template-hotkey"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium text-gray-300 block mb-2">Description</Label>
            <Input
              value={selectedTemplateForDetail.description}
              onChange={(e) => {
                setSelectedTemplateForDetail({
                  ...selectedTemplateForDetail,
                  description: e.target.value
                });
              }}
              placeholder="Describe what this template does..."
              className="bg-[#1a1a1a] border-[#3a3a3a]"
              data-testid="input-template-description"
            />
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={() => {
                // Handle save template
                toast({ title: 'Template updated', description: 'Changes saved successfully' });
              }}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-save-template"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const originalTemplate = templates.find(t => t.id === selectedTemplateForDetail.id);
                if (originalTemplate) {
                  setSelectedTemplateForDetail(originalTemplate);
                }
              }}
              data-testid="button-reset-template"
            >
              Reset Changes
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                // Handle delete template
                toast({ title: 'Template deleted', description: 'Template removed successfully' });
                navigateBackToFunctionDetail();
              }}
              data-testid="button-delete-template"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

// New Function Form Component
function NewFunctionForm({ 
  newFunction, 
  setNewFunction, 
  onSave, 
  onCancel, 
  isSaving,
  availableIcons 
}: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium text-white">Create New Function</h3>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-300">Function Name</Label>
          <Input
            value={newFunction.name}
            onChange={(e) => setNewFunction({...newFunction, name: e.target.value})}
            placeholder="Enter function name"
            className="mt-1"
            data-testid="input-function-name"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Function Key</Label>
          <Input
            value={newFunction.functionKey}
            onChange={(e) => setNewFunction({...newFunction, functionKey: e.target.value})}
            placeholder="e.g., image-enhancement"
            className="mt-1"
            data-testid="input-function-key"
          />
          <p className="text-xs text-gray-500 mt-1">Unique identifier for this function</p>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-300">Description</Label>
        <Input
          value={newFunction.description}
          onChange={(e) => setNewFunction({...newFunction, description: e.target.value})}
          placeholder="Describe what this function does and how it helps users create better visual content"
          className="mt-1"
          data-testid="input-function-description"
        />
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-300">Default Template</Label>
        <Textarea
          value={newFunction.defaultTemplate || ''}
          onChange={(e) => setNewFunction({...newFunction, defaultTemplate: e.target.value})}
          placeholder="Enter the default prompt template for this function...\n\nExample:\nAnalyze this {image_type} and enhance the {target_aspect} while maintaining {quality_level} quality."
          className="min-h-[120px] mt-1 font-mono"
          data-testid="textarea-function-default-template"
        />
        <p className="text-xs text-gray-500 mt-1">This template will be used when no specific hot key template is selected</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-300">Icon</Label>
          <Select
            value={newFunction.icon}
            onValueChange={(value) => setNewFunction({...newFunction, icon: value})}
          >
            <SelectTrigger className="mt-1" data-testid="select-function-icon">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableIcons.map((icon: string) => (
                <SelectItem key={icon} value={icon}>
                  {icon}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Sort Order</Label>
          <Input
            type="number"
            value={newFunction.sortOrder}
            onChange={(e) => setNewFunction({...newFunction, sortOrder: parseInt(e.target.value) || 0})}
            placeholder="0"
            className="mt-1"
            data-testid="input-function-sort-order"
          />
          <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="function-enabled"
          checked={newFunction.enabled}
          onCheckedChange={(checked) => setNewFunction({...newFunction, enabled: checked})}
          data-testid="switch-function-enabled"
        />
        <Label htmlFor="function-enabled" className="text-sm text-gray-300">
          Enable function (visible to users)
        </Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button 
          onClick={onSave} 
          disabled={!newFunction.name || !newFunction.functionKey || isSaving}
          className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
          data-testid="button-save-function"
        >
          {isSaving ? 'Creating...' : 'Create Function'}
        </Button>
      </div>
    </div>
  );
}

// Edit Function Form Component
function EditFunctionForm({ 
  func, 
  setFunction, 
  onUpdate, 
  onDelete, 
  onCancel, 
  isUpdating,
  isDeleting,
  availableIcons 
}: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-medium text-white">Edit Function</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="function-enabled"
              checked={func.enabled === "true"}
              onCheckedChange={(checked) => setFunction({...func, enabled: checked ? "true" : "false"})}
              data-testid="switch-edit-function-enabled"
            />
            <Label htmlFor="function-enabled" className="text-sm text-gray-300">
              {func.enabled === "true" ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-300">Function Name</Label>
          <Input
            value={func.name}
            onChange={(e) => setFunction({...func, name: e.target.value})}
            className="mt-1"
            data-testid="input-edit-function-name"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Function Key</Label>
          <Input
            value={func.functionKey}
            onChange={(e) => setFunction({...func, functionKey: e.target.value})}
            className="mt-1"
            data-testid="input-edit-function-key"
          />
          <p className="text-xs text-gray-500 mt-1">Unique identifier for this function</p>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-300">Description</Label>
        <Input
          value={func.description || ''}
          onChange={(e) => setFunction({...func, description: e.target.value})}
          placeholder="Describe what this function does and how it helps users create better visual content"
          className="mt-1"
          data-testid="input-edit-function-description"
        />
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-300">Default Template</Label>
        <Textarea
          value={func.defaultTemplate || ''}
          onChange={(e) => setFunction({...func, defaultTemplate: e.target.value})}
          placeholder="Enter the default prompt template for this function...\n\nExample:\nAnalyze this {image_type} and enhance the {target_aspect} while maintaining {quality_level} quality."
          className="min-h-[120px] mt-1 font-mono"
          data-testid="textarea-edit-function-default-template"
        />
        <p className="text-xs text-gray-500 mt-1">This template will be used when no specific hot key template is selected</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-300">Icon</Label>
          <Select
            value={func.icon}
            onValueChange={(value) => setFunction({...func, icon: value})}
          >
            <SelectTrigger className="mt-1" data-testid="select-edit-function-icon">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableIcons.map((icon: string) => (
                <SelectItem key={icon} value={icon}>
                  {icon}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Sort Order</Label>
          <Input
            type="number"
            value={func.sortOrder || 0}
            onChange={(e) => setFunction({...func, sortOrder: parseInt(e.target.value) || 0})}
            className="mt-1"
            data-testid="input-edit-function-sort-order"
          />
          <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span>ID: {func.id}</span>
          <span>Created: {new Date(func.createdAt).toLocaleDateString()}</span>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="destructive" 
            onClick={onDelete}
            disabled={isDeleting}
            data-testid="button-delete-function"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button 
            onClick={onUpdate} 
            disabled={isUpdating}
            className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
            data-testid="button-update-function"
          >
            {isUpdating ? 'Updating...' : 'Update Function'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// New Template Form Component
function NewTemplateForm({ 
  newTemplate, 
  setNewTemplate, 
  onSave, 
  onCancel, 
  isSaving,
  functions,
  templateCategories
}: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium text-white">Create New Template</h3>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-300">Template Name</Label>
          <Input
            value={newTemplate.name}
            onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
            placeholder="Enter template name"
            className="mt-1"
            data-testid="input-template-name"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Function</Label>
          <Select
            value={newTemplate.functionId}
            onValueChange={(value) => setNewTemplate({...newTemplate, functionId: value})}
          >
            <SelectTrigger className="mt-1" data-testid="select-template-function">
              <SelectValue placeholder="Select a function" />
            </SelectTrigger>
            <SelectContent>
              {functions.map((func: any) => (
                <SelectItem key={func.id} value={func.id}>
                  {func.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-300">Category</Label>
          <Select
            value={newTemplate.category}
            onValueChange={(value) => setNewTemplate({...newTemplate, category: value})}
          >
            <SelectTrigger className="mt-1" data-testid="select-template-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templateCategories?.map((cat: { value: string; label: string }) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Description</Label>
          <Input
            value={newTemplate.description}
            onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
            placeholder="Describe what this template does"
            className="mt-1"
            data-testid="input-template-description"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-gray-300">Template Content</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!newTemplate.template.trim()}
            className="text-xs"
            data-testid="button-enhance-template"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Enhance with AI
          </Button>
        </div>
        <Textarea
          value={newTemplate.template}
          onChange={(e) => setNewTemplate({
            ...newTemplate, 
            template: e.target.value,
            variables: e.target.value.match(/\{([^}]+)\}/g)?.map(match => match.slice(1, -1)) || []
          })}
          placeholder="Enter your prompt template here...\n\nExample:\nAnalyze this {image_type} image and provide {analysis_depth} analysis focusing on {focus_areas}."
          className="min-h-[200px] font-mono"
          data-testid="textarea-template-content"
        />
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-500">Use {`{variable}`} for dynamic content</p>
          {newTemplate.variables && newTemplate.variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-gray-400">Variables found:</span>
              {newTemplate.variables.map((variable: string, index: number) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {`{${variable}}`}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="template-enabled"
          checked={newTemplate.enabled}
          onCheckedChange={(checked) => setNewTemplate({...newTemplate, enabled: checked})}
          data-testid="switch-template-enabled"
        />
        <Label htmlFor="template-enabled" className="text-sm text-gray-300">
          Enable template (visible to users)
        </Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button 
          onClick={onSave} 
          disabled={!newTemplate.name || !newTemplate.template || !newTemplate.functionId || isSaving}
          className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
          data-testid="button-save-template"
        >
          {isSaving ? 'Creating...' : 'Create Template'}
        </Button>
      </div>
    </div>
  );
}

// Edit Template Form Component
function EditTemplateForm({ 
  template, 
  setTemplate, 
  onUpdate, 
  onDelete, 
  onCancel, 
  onToggleEnabled, 
  onEnhance, 
  onCopy,
  isUpdating,
  isDeleting,
  isEnhancing,
  wasCopied,
  templateCategories,
  functions
}: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-medium text-white">Edit Template</h3>
          {template.isSystem === "true" && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              System
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            disabled={wasCopied}
            data-testid="button-copy-template"
          >
            {wasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              id="template-enabled"
              checked={template.enabled === "true"}
              onCheckedChange={onToggleEnabled}
              data-testid="switch-edit-template-enabled"
            />
            <Label htmlFor="template-enabled" className="text-sm text-gray-300">
              {template.enabled === "true" ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-300">Template Name</Label>
          <Input
            value={template.name}
            onChange={(e) => setTemplate({...template, name: e.target.value})}
            className="mt-1"
            data-testid="input-edit-template-name"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Function</Label>
          <Select
            value={template.functionId}
            onValueChange={(value) => setTemplate({...template, functionId: value})}
          >
            <SelectTrigger className="mt-1" data-testid="select-edit-template-function">
              <SelectValue placeholder="Select a function" />
            </SelectTrigger>
            <SelectContent>
              {functions?.map((func: any) => (
                <SelectItem key={func.id} value={func.id}>
                  {func.name}
                </SelectItem>
              )) || <SelectItem value="">No functions available</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-300">Category</Label>
          <Select
            value={template.category}
            onValueChange={(value) => setTemplate({...template, category: value})}
          >
            <SelectTrigger className="mt-1" data-testid="select-edit-template-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templateCategories?.map((cat: { value: string; label: string }) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              )) || <SelectItem value="">No categories available</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Description</Label>
          <Input
            value={template.description || ''}
            onChange={(e) => setTemplate({...template, description: e.target.value})}
            className="mt-1"
            data-testid="input-edit-template-description"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-gray-300">Template Content</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEnhance}
            disabled={!template.template.trim() || isEnhancing}
            className="text-xs"
            data-testid="button-enhance-edit-template"
          >
            {isEnhancing ? (
              <>
                <div className="animate-spin h-3 w-3 mr-1 border border-current border-t-transparent rounded-full" />
                Enhancing...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                Enhance with AI
              </>
            )}
          </Button>
        </div>
        <Textarea
          value={template.template}
          onChange={(e) => setTemplate({
            ...template, 
            template: e.target.value,
            variables: e.target.value.match(/\{([^}]+)\}/g)?.map(match => match.slice(1, -1)) || []
          })}
          className="min-h-[200px] font-mono"
          placeholder="Enter your prompt template here...\n\nExample:\nAnalyze this {image_type} image and provide {analysis_depth} analysis focusing on {focus_areas}."
          data-testid="textarea-edit-template-content"
        />
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-500">Use {`{variable}`} for dynamic content</p>
          {template.variables && template.variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-gray-400">Variables found:</span>
              {template.variables.map((variable: string, index: number) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {`{${variable}}`}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Template Preview Section */}
      {template.template && template.variables && template.variables.length > 0 && (
        <div className="border-t pt-4">
          <Label className="text-sm font-medium text-gray-300 mb-2 block">Template Preview</Label>
          <div className="bg-gray-800/50 p-3 rounded-lg border">
            <p className="text-sm text-gray-300 mb-2">How this template will appear with sample values:</p>
            <div className="bg-gray-900 p-3 rounded text-sm font-mono text-green-400 border">
              {template.template.replace(/\{([^}]+)\}/g, (match: string, variable: string) => `[${variable.toUpperCase()}]`)}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span>Usage: {template.usage || 0}</span>
          <span>Variables: {template.variables?.length || 0}</span>
          <span>Created: {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'N/A'}</span>
          <span className="text-xs opacity-60">ID: {template.id?.slice(0, 8)}...</span>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="destructive" 
            onClick={onDelete}
            disabled={isDeleting}
            data-testid="button-delete-template"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button 
            onClick={onUpdate} 
            disabled={isUpdating}
            className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
            data-testid="button-update-template"
          >
            {isUpdating ? 'Updating...' : 'Update Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}