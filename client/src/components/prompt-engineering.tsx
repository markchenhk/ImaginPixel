import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Plus, Edit3, Trash2, Save, Copy, Download, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  variables: string[];
  isSystem: boolean;
  usage: number;
  createdAt: string;
  updatedAt: string;
}

interface PromptEngineeringProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PromptEngineering({ isOpen, onClose }: PromptEngineeringProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'image-enhancement',
    template: '',
    variables: [] as string[]
  });
  const [showNewForm, setShowNewForm] = useState(false);

  // Categories for prompt organization
  const categories = [
    { value: 'all', label: 'All Templates' },
    { value: 'image-enhancement', label: 'Image Enhancement' },
    { value: 'background-removal', label: 'Background Removal' },
    { value: 'style-transfer', label: 'Style Transfer' },
    { value: 'object-removal', label: 'Object Removal' },
    { value: 'color-correction', label: 'Color Correction' },
    { value: 'product-photography', label: 'Product Photography' },
    { value: 'custom', label: 'Custom Templates' }
  ];

  // Default system templates
  const systemTemplates: PromptTemplate[] = [
    {
      id: 'sys-enhance-1',
      name: 'Product Image Enhancement',
      description: 'Professional enhancement for e-commerce product photos',
      category: 'image-enhancement',
      template: 'Enhance this product image for e-commerce: improve lighting, increase clarity, remove shadows, adjust colors to be vibrant and professional. Make it suitable for online marketplace listings.',
      variables: [],
      isSystem: true,
      usage: 245,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sys-bg-1',
      name: 'Clean Background Removal',
      description: 'Remove background and replace with clean white',
      category: 'background-removal',
      template: 'Remove the background from this image and replace it with a clean, pure white background. Preserve all product details and edges precisely.',
      variables: [],
      isSystem: true,
      usage: 189,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sys-style-1',
      name: 'Professional Photography Style',
      description: 'Transform image to professional photography style',
      category: 'style-transfer',
      template: 'Transform this image to match professional studio photography style: perfect lighting, sharp focus, minimal shadows, professional composition suitable for marketing materials.',
      variables: [],
      isSystem: true,
      usage: 156,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Fetch custom templates (this would be from API in real implementation)
  const { data: customTemplates } = useQuery<PromptTemplate[]>({
    queryKey: ['/api/prompt-templates'],
    queryFn: async () => {
      // For now, return empty array - would implement API endpoint
      return [];
    },
    enabled: isOpen
  });

  // All templates (system + custom)
  const allTemplates = [...systemTemplates, ...(customTemplates || [])];
  const filteredTemplates = selectedCategory === 'all' 
    ? allTemplates 
    : allTemplates.filter(t => t.category === selectedCategory);

  // Extract variables from template text
  const extractVariables = (template: string): string[] => {
    const matches = template.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  };

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: Partial<PromptTemplate>) => {
      const response = await apiRequest('POST', '/api/prompt-templates', template);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
      toast({
        title: 'Template saved',
        description: 'Prompt template has been saved successfully.',
      });
      setShowNewForm(false);
      setNewTemplate({
        name: '',
        description: '',
        category: 'image-enhancement',
        template: '',
        variables: []
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle template save
  const handleSaveTemplate = () => {
    if (!newTemplate.name || !newTemplate.template) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in template name and content.',
        variant: 'destructive',
      });
      return;
    }

    const variables = extractVariables(newTemplate.template);
    saveTemplateMutation.mutate({
      ...newTemplate,
      variables,
      isSystem: false,
      usage: 0
    });
  };

  // Copy template to clipboard
  const copyTemplate = (template: string) => {
    navigator.clipboard.writeText(template);
    toast({
      title: 'Copied',
      description: 'Template copied to clipboard.',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-6xl h-[90vh] flex flex-col border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <Wand2 className="h-6 w-6 text-[#ffd700]" />
            <h2 className="text-2xl font-bold text-white">Prompt Engineering</h2>
            <Badge className="bg-[#ffd700]/20 text-[#ffd700] border-[#ffd700]/30">
              Admin Only
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            data-testid="close-prompt-engineering"
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
                <SelectTrigger data-testid="category-select">
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
              data-testid="new-template-button"
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
                  className="p-3 bg-[#2a2a2a] border-[#3a3a3a] cursor-pointer hover:bg-[#3a3a3a] transition-colors"
                  onClick={() => setEditingTemplate(template)}
                  data-testid={`template-${template.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm">{template.name}</span>
                      {template.isSystem && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{template.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{template.usage} uses</span>
                      <span>{template.variables.length} vars</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {showNewForm ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-medium text-white">Create New Template</h3>
                  <Button
                    variant="ghost"
                    onClick={() => setShowNewForm(false)}
                    data-testid="cancel-new-template"
                  >
                    Cancel
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-300">Template Name</Label>
                    <Input
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                      placeholder="Enter template name"
                      className="mt-1"
                      data-testid="template-name-input"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-300">Category</Label>
                    <Select
                      value={newTemplate.category}
                      onValueChange={(value) => setNewTemplate({...newTemplate, category: value})}
                    >
                      <SelectTrigger className="mt-1" data-testid="new-template-category">
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
                    data-testid="template-description-input"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-300">
                    Template Content
                    <span className="text-xs text-gray-500 ml-2">Use {`{variable}`} for dynamic content</span>
                  </Label>
                  <Textarea
                    value={newTemplate.template}
                    onChange={(e) => {
                      const template = e.target.value;
                      const variables = extractVariables(template);
                      setNewTemplate({...newTemplate, template, variables});
                    }}
                    placeholder="Enter your prompt template..."
                    className="mt-1 min-h-32"
                    data-testid="template-content-input"
                  />
                  {newTemplate.variables.length > 0 && (
                    <div className="mt-2">
                      <Label className="text-xs text-gray-400">Detected Variables:</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {newTemplate.variables.map(variable => (
                          <Badge key={variable} className="bg-[#ffd700]/20 text-[#ffd700] text-xs">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSaveTemplate}
                  disabled={saveTemplateMutation.isPending}
                  className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90"
                  data-testid="save-template-button"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            ) : editingTemplate ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-medium text-white">{editingTemplate.name}</h3>
                    <p className="text-gray-400">{editingTemplate.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => copyTemplate(editingTemplate.template)}
                      data-testid="copy-template-button"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditingTemplate(null)}
                      data-testid="close-template-view"
                    >
                      Close
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4 bg-[#2a2a2a] border-[#3a3a3a]">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#ffd700]">{editingTemplate.usage}</div>
                      <div className="text-sm text-gray-400">Total Uses</div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-[#2a2a2a] border-[#3a3a3a]">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#ffd700]">{editingTemplate.variables.length}</div>
                      <div className="text-sm text-gray-400">Variables</div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-[#2a2a2a] border-[#3a3a3a]">
                    <div className="text-center">
                      <Badge className={editingTemplate.isSystem ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}>
                        {editingTemplate.isSystem ? 'System' : 'Custom'}
                      </Badge>
                      <div className="text-sm text-gray-400 mt-1">Type</div>
                    </div>
                  </Card>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-300">Template Content</Label>
                  <Textarea
                    value={editingTemplate.template}
                    readOnly
                    className="mt-1 min-h-48 bg-[#2a2a2a] border-[#3a3a3a]"
                    data-testid="template-content-display"
                  />
                </div>

                {editingTemplate.variables.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-300">Variables</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editingTemplate.variables.map(variable => (
                        <Badge key={variable} className="bg-[#ffd700]/20 text-[#ffd700] border-[#ffd700]/30">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <Wand2 className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-lg font-medium mb-2">Prompt Engineering Hub</h3>
                  <p className="max-w-md">
                    Create, manage, and optimize AI prompts for image processing. 
                    Select a template from the sidebar or create a new one to get started.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}