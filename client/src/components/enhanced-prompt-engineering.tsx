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
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PromptTemplate } from '@shared/schema';
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
  Check 
} from 'lucide-react';

interface EnhancedPromptEngineeringProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnhancedPromptEngineering({ isOpen, onClose }: EnhancedPromptEngineeringProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [enhancingTemplate, setEnhancingTemplate] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'image-enhancement',
    template: '',
    variables: [] as string[],
    enabled: true
  });

  const categories = [
    { value: 'all', label: 'All Templates' },
    { value: 'image-enhancement', label: 'Image Enhancement' },
    { value: 'background-removal', label: 'Background Removal' },
    { value: 'style-transfer', label: 'Style Transfer' },
    { value: 'upscaling', label: 'Upscaling' },
    { value: 'color-correction', label: 'Color Correction' },
    { value: 'custom', label: 'Custom' }
  ];

  // Fetch all templates from API
  const { data: templates = [], isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['/api/admin/prompt-templates'],
    enabled: isOpen
  });

  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  // Extract variables from template text
  const extractVariables = (template: string): string[] => {
    const matches = template.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  };

  // Create template mutation
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
      setShowNewForm(false);
      resetNewTemplate();
    },
  });

  // Update template mutation
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

  // Delete template mutation
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
      // Call OpenRouter API to enhance the template
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
      category: 'image-enhancement',
      template: '',
      variables: [],
      enabled: true
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

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;
    const updates = {
      ...editingTemplate,
      variables: extractVariables(editingTemplate.template),
      enabled: editingTemplate.enabled === "true" ? "true" : "false"
    };
    updateTemplateMutation.mutate({ id: editingTemplate.id, updates });
  };

  const handleToggleEnabled = (template: PromptTemplate) => {
    const newEnabled = template.enabled === "true" ? "false" : "true";
    updateTemplateMutation.mutate({ 
      id: template.id, 
      updates: { enabled: newEnabled } 
    });
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
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-[#2a2a2a] p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setShowNewForm(true)}
              className="w-full bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              <Label className="text-sm font-medium text-gray-300">
                Templates ({filteredTemplates.length})
              </Label>
              {filteredTemplates.map(template => (
                <Card
                  key={template.id}
                  className={`p-3 border-[#3a3a3a] cursor-pointer hover:bg-[#3a3a3a] transition-colors ${
                    template.enabled === "false" ? 'bg-[#2a2a2a]/50 opacity-60' : 'bg-[#2a2a2a]'
                  }`}
                  onClick={() => setEditingTemplate(template)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm truncate">{template.name}</span>
                      <div className="flex items-center gap-1">
                        {template.isSystem === "true" && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                            System
                          </Badge>
                        )}
                        {template.enabled === "false" ? (
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
                    <p className="text-xs text-gray-400 line-clamp-2">{template.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{template.usage || 0} uses</span>
                      <span>{template.variables?.length || 0} vars</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {showNewForm ? (
              <NewTemplateForm 
                newTemplate={newTemplate}
                setNewTemplate={setNewTemplate}
                onSave={handleSaveTemplate}
                onCancel={() => { setShowNewForm(false); resetNewTemplate(); }}
                onEnhance={() => handleEnhanceTemplate(newTemplate.template)}
                isSaving={createTemplateMutation.isPending}
                isEnhancing={enhancingTemplate === newTemplate.template}
                categories={categories}
              />
            ) : editingTemplate ? (
              <EditTemplateForm 
                template={editingTemplate}
                setTemplate={setEditingTemplate}
                onUpdate={handleUpdateTemplate}
                onDelete={() => deleteTemplateMutation.mutate(editingTemplate.id)}
                onCancel={() => setEditingTemplate(null)}
                onToggleEnabled={(checked: boolean) => {
                  const newEnabled = checked ? "true" : "false";
                  const updatedTemplate = { ...editingTemplate, enabled: newEnabled };
                  setEditingTemplate(updatedTemplate);
                  
                  // Update both admin and user template caches immediately for UI responsiveness
                  queryClient.setQueryData(['/api/admin/prompt-templates'], (oldData: PromptTemplate[] | undefined) => {
                    if (!oldData) return oldData;
                    return oldData.map(template => 
                      template.id === editingTemplate.id 
                        ? { ...template, enabled: newEnabled }
                        : template
                    );
                  });
                  
                  queryClient.setQueryData(['/api/prompt-templates'], (oldData: PromptTemplate[] | undefined) => {
                    if (!oldData) return oldData;
                    return oldData.map(template => 
                      template.id === editingTemplate.id 
                        ? { ...template, enabled: newEnabled }
                        : template
                    );
                  });
                  
                  updateTemplateMutation.mutate({ 
                    id: editingTemplate.id, 
                    updates: { enabled: newEnabled } 
                  });
                }}
                onEnhance={() => handleEnhanceTemplate(editingTemplate.template)}
                onCopy={() => handleCopyTemplate(editingTemplate)}
                isUpdating={updateTemplateMutation.isPending}
                isDeleting={deleteTemplateMutation.isPending}
                isEnhancing={enhancingTemplate === editingTemplate.template}
                wasCopied={copiedTemplate === editingTemplate.id}
                categories={categories}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a template to edit or create a new one</p>
                </div>
              </div>
            )}
          </div>
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
  categories 
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
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Category</Label>
          <Select
            value={newTemplate.category}
            onValueChange={(value) => setNewTemplate({...newTemplate, category: value})}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.filter(cat => cat.value !== 'all').map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-300">Description</Label>
        <Input
          value={newTemplate.description}
          onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
          placeholder="Describe what this template does"
          className="mt-1"
        />
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
        />
        <p className="text-xs text-gray-500 mt-1">Use {`{variable}`} for dynamic content</p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={newTemplate.enabled}
          onCheckedChange={(checked) => setNewTemplate({...newTemplate, enabled: checked})}
        />
        <Label htmlFor="enabled" className="text-sm text-gray-300">
          Enable template (visible to users)
        </Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button 
          onClick={onSave} 
          disabled={!newTemplate.name || !newTemplate.template || isSaving}
          className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
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
  categories 
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
          >
            {wasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              id="template-enabled"
              checked={template.enabled === "true"}
              onCheckedChange={onToggleEnabled}
              data-testid="toggle-enabled-switch"
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
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-300">Category</Label>
          <Select
            value={template.category}
            onValueChange={(value) => setTemplate({...template, category: value})}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.filter(cat => cat.value !== 'all').map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-300">Description</Label>
        <Input
          value={template.description || ''}
          onChange={(e) => setTemplate({...template, description: e.target.value})}
          className="mt-1"
        />
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
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span>Usage: {template.usage || 0}</span>
          <span>Variables: {template.variables?.length || 0}</span>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="destructive" 
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button 
            onClick={onUpdate} 
            disabled={isUpdating}
            className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
          >
            {isUpdating ? 'Updating...' : 'Update Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}