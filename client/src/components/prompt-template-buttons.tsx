import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { PromptTemplate } from "@shared/schema";

interface PromptTemplateButtonsProps {
  onTemplateSelect: (template: PromptTemplate) => void;
}

export function PromptTemplateButtons({ onTemplateSelect }: PromptTemplateButtonsProps) {
  const queryClient = useQueryClient();

  // Fetch prompt templates
  const { data: templates = [], isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['/api/prompt-templates']
  });

  // Increment usage mutation
  const incrementUsageMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest('POST', `/api/prompt-templates/${templateId}/usage`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
    }
  });

  const handleTemplateClick = (template: PromptTemplate) => {
    // Increment usage count
    incrementUsageMutation.mutate(template.id);
    
    // Call the parent handler with the full template
    onTemplateSelect(template);
  };

  if (isLoading) {
    return (
      <div className="flex gap-2 mt-3">
        {/* Loading skeleton */}
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 bg-[#2a2a2a] border border-[#3a3a3a] rounded animate-pulse"
            style={{ width: `${80 + i * 20}px` }}
          />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex gap-2 mt-3">
        <div className="text-xs text-[#888888] py-2">
          No prompt templates configured. Admin can create templates in Prompt Engineering.
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      {templates.map((template) => (
        <Button
          key={template.id}
          variant="ghost"
          size="sm"
          className="text-xs bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#e0e0e0] border border-[#3a3a3a] transition-all hover:border-[#ffd700]/30"
          onClick={() => handleTemplateClick(template)}
          disabled={incrementUsageMutation.isPending}
          data-testid={`template-button-${template.id}`}
          title={template.description || template.name}
        >
          <span className="truncate max-w-[120px]">
            {template.name}
          </span>
          {template.usage != null && template.usage > 0 && (
            <span className="ml-1 text-[10px] text-[#888888] bg-[#1a1a1a] px-1 rounded">
              {template.usage}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}