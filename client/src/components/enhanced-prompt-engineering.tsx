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
  FileText
} from 'lucide-react';

interface EnhancedPromptEngineeringProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFunction?: 'image-enhancement' | 'image-to-video';
  isAdmin: boolean;
}

export function EnhancedPromptEngineering({ isOpen, onClose, selectedFunction = 'image-enhancement', isAdmin }: EnhancedPromptEngineeringProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'functions' | 'templates'>('functions');
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [editingFunction, setEditingFunction] = useState<ApplicationFunction | null>(null);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [showNewFunctionForm, setShowNewFunctionForm] = useState(false);
  const [enhancingTemplate, setEnhancingTemplate] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  
  // Effect to clear editing states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEditingTemplate(null);
      setEditingFunction(null);
      setShowNewTemplateForm(false);
      setShowNewFunctionForm(false);
      setEnhancingTemplate(null);
      setCopiedTemplate(null);
      setSelectedFunctionId('all');
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
    sortOrder: 0
  });

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
      sortOrder: Math.max(...functions.map(f => f.sortOrder || 0), 0) + 1
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
    // Find the template and its function's templates
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const functionTemplates = templatesByFunction[template.functionId] || [];
    const sortedTemplates = functionTemplates
      .filter(t => t.enabled !== "false")
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    
    const currentIndex = sortedTemplates.findIndex(t => t.id === templateId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedTemplates.length) return;

    // Swap sort orders
    const currentSortOrder = sortedTemplates[currentIndex].sortOrder || currentIndex;
    const targetSortOrder = sortedTemplates[targetIndex].sortOrder || targetIndex;

    updateTemplateMutation.mutate({ 
      id: templateId, 
      updates: { sortOrder: targetSortOrder }
    });
    updateTemplateMutation.mutate({ 
      id: sortedTemplates[targetIndex].id, 
      updates: { sortOrder: currentSortOrder }
    });
  };

  if (!isOpen) return null;

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
              {/* Main Content */}
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
                      .map(func => {
                        const displayFunction = editingFunction && editingFunction.id === func.id ? editingFunction : func;
                        
                        return (
                          <div key={func.id} className="space-y-2">
                            <Card
                              className={`p-3 border-[#3a3a3a] cursor-pointer hover:bg-[#3a3a3a] transition-colors ${
                                displayFunction.enabled === "false" ? 'bg-[#2a2a2a]/50 opacity-60' : 'bg-[#2a2a2a]'
                              }`}
                              onClick={() => {
                                setEditingFunction(func);
                                setShowNewFunctionForm(false);
                              }}
                              data-testid={`card-function-${func.functionKey}`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-white text-sm truncate">{displayFunction.name}</span>
                                  <div className="flex items-center gap-1">
                                    {displayFunction.enabled === "false" ? (
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
                                <p className="text-xs text-gray-400 line-clamp-2">{displayFunction.description}</p>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>Key: {displayFunction.functionKey}</span>
                                  <span>Order: {displayFunction.sortOrder || 0}</span>
                                </div>
                              </div>
                            </Card>
                            
                            {/* Hot Keys (Templates) */}
                            {templatesByFunction[func.id] && templatesByFunction[func.id].length > 0 && (
                              <div className="ml-2 space-y-1">
                                <div className="flex items-center gap-1 mb-2">
                                  <Hash className="h-3 w-3 text-[#ffd700]" />
                                  <span className="text-xs font-medium text-[#ffd700]">Hot Keys ({templatesByFunction[func.id].length})</span>
                                </div>
                                {templatesByFunction[func.id]
                                  .filter(template => template.enabled !== "false")
                                  .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                                  .slice(0, 3) // Show only first 3 templates
                                  .map((template, index) => (
                                    <div
                                      key={template.id}
                                      className="group flex items-center justify-between p-2 bg-[#1a1a1a] border border-[#333] rounded text-xs hover:bg-[#2a2a2a] transition-colors"
                                      data-testid={`hotkey-template-${template.id}`}
                                    >
                                      <div
                                        className="flex items-center gap-2 flex-1 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTemplate(template);
                                          setActiveTab('templates');
                                          setShowNewTemplateForm(false);
                                        }}
                                      >
                                        <Sparkles className="h-3 w-3 text-[#ffd700]" />
                                        <span className="text-white truncate">{template.name}</span>
                                        {template.isSystem === "true" && (
                                          <Badge className="h-4 text-[8px] bg-blue-500/20 text-blue-400 border-blue-500/30 px-1">
                                            SYS
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] text-gray-500 mr-1">{template.usage}</span>
                                        
                                        {/* Template actions dropdown */}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-5 w-5 p-0 hover:bg-[#3a3a3a]"
                                              onClick={(e) => e.stopPropagation()}
                                              data-testid={`button-template-menu-${template.id}`}
                                            >
                                              <MoreVertical className="h-3 w-3 text-gray-400" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-36">
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTemplate(template);
                                                setActiveTab('templates');
                                              }}
                                              className="flex items-center gap-2"
                                              data-testid={`menu-edit-${template.id}`}
                                            >
                                              <Edit3 className="h-3 w-3" />
                                              Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopyTemplate(template);
                                              }}
                                              className="flex items-center gap-2"
                                              data-testid={`menu-duplicate-${template.id}`}
                                            >
                                              <Copy className="h-3 w-3" />
                                              Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleTemplateEnabled(template);
                                              }}
                                              className="flex items-center gap-2"
                                              data-testid={`menu-toggle-${template.id}`}
                                            >
                                              {template.enabled === "true" ? (
                                                <>
                                                  <EyeOff className="h-3 w-3" />
                                                  Disable
                                                </>
                                              ) : (
                                                <>
                                                  <Eye className="h-3 w-3" />
                                                  Enable
                                                </>
                                              )}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
                                                  deleteTemplateMutation.mutate(template.id);
                                                }
                                              }}
                                              className="flex items-center gap-2 text-red-400 focus:text-red-300"
                                              data-testid={`menu-delete-${template.id}`}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  ))}
                                
                                {templatesByFunction[func.id].length > 3 && (
                                  <div className="text-xs text-gray-500 ml-2">
                                    +{templatesByFunction[func.id].length - 3} more templates...
                                  </div>
                                )}
                                
                                {/* Quick Add Template Button */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full h-6 text-xs text-[#ffd700] hover:bg-[#ffd700]/10 border border-[#ffd700]/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resetNewTemplate();
                                    setNewTemplate(prev => ({ ...prev, functionId: func.id }));
                                    setShowNewTemplateForm(true);
                                    setActiveTab('templates');
                                    setEditingTemplate(null);
                                  }}
                                  data-testid={`button-add-template-${func.functionKey}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Template
                                </Button>
                              </div>
                            )}
                            
                            {/* Show Add Template button even if no templates exist */}
                            {(!templatesByFunction[func.id] || templatesByFunction[func.id].length === 0) && (
                              <div className="ml-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full h-6 text-xs text-gray-500 hover:bg-[#ffd700]/10 hover:text-[#ffd700] border border-gray-600 hover:border-[#ffd700]/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resetNewTemplate();
                                    setNewTemplate(prev => ({ ...prev, functionId: func.id }));
                                    setShowNewTemplateForm(true);
                                    setActiveTab('templates');
                                    setEditingTemplate(null);
                                  }}
                                  data-testid={`button-add-first-template-${func.functionKey}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add First Template
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Main Content - Functions */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {showNewFunctionForm ? (
                    <NewFunctionForm 
                      newFunction={newFunction}
                      setNewFunction={setNewFunction}
                      onSave={handleSaveFunction}
                      onCancel={() => { setShowNewFunctionForm(false); resetNewFunction(); }}
                      isSaving={createFunctionMutation.isPending}
                      availableIcons={availableIcons}
                    />
                  ) : editingFunction ? (
                    <EditFunctionForm 
                      func={editingFunction}
                      setFunction={setEditingFunction}
                      onUpdate={handleUpdateFunction}
                      onDelete={() => deleteFunctionMutation.mutate(editingFunction.id)}
                      onCancel={() => setEditingFunction(null)}
                      isUpdating={updateFunctionMutation.isPending}
                      isDeleting={deleteFunctionMutation.isPending}
                      availableIcons={availableIcons}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-400">
                        <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a function to edit or create a new one</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
          placeholder="Describe what this function does"
          className="mt-1"
          data-testid="input-function-description"
        />
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
          className="mt-1"
          data-testid="input-edit-function-description"
        />
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
  onEnhance,
  isSaving,
  isEnhancing,
  categories,
  functions
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
              {categories.map((cat: { value: string; label: string }) => (
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
            onClick={onEnhance}
            disabled={!newTemplate.template.trim() || isEnhancing}
            className="text-xs"
            data-testid="button-enhance-template"
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
          value={newTemplate.template}
          onChange={(e) => setNewTemplate({
            ...newTemplate, 
            template: e.target.value,
            variables: e.target.value.match(/\{([^}]+)\}/g)?.map(match => match.slice(1, -1)) || []
          })}
          placeholder="Enter your prompt template here..."
          className="min-h-[200px]"
          data-testid="textarea-template-content"
        />
        <p className="text-xs text-gray-500 mt-1">Use {`{variable}`} for dynamic content</p>
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
  categories,
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
            value={template.category}
            onValueChange={(value) => setTemplate({...template, category: value})}
          >
            <SelectTrigger className="mt-1" data-testid="select-edit-template-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat: { value: string; label: string }) => (
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
          className="min-h-[200px]"
          data-testid="textarea-edit-template-content"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span>Usage: {template.usage || 0}</span>
          <span>Variables: {template.variables?.length || 0}</span>
          <span>ID: {template.id}</span>
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