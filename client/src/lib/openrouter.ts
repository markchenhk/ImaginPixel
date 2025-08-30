import { OpenRouterModel } from '../types';

export const AVAILABLE_MODELS: { [key: string]: OpenRouterModel } = {
  'openai/dall-e-3': {
    id: 'openai/dall-e-3',
    name: 'DALL-E 3',
    description: 'Advanced image generation and editing capabilities',
    pricing: {
      prompt: '$0.04',
      completion: '$0.08'
    },
    context_length: 4000,
    architecture: {
      modality: 'text+image_generation',
      tokenizer: 'cl100k_base',
      instruct_type: null
    },
    top_provider: {
      context_length: 4000,
      max_completion_tokens: 1000,
      is_moderated: true
    },
    per_request_limits: {
      prompt_tokens: '4000',
      completion_tokens: '1000'
    }
  },
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (Analysis Only)',
    description: 'Advanced image understanding and analysis - no generation',
    pricing: {
      prompt: '$5.00',
      completion: '$15.00'
    },
    context_length: 128000,
    architecture: {
      modality: 'text+vision',
      tokenizer: 'cl100k_base',
      instruct_type: null
    },
    top_provider: {
      context_length: 128000,
      max_completion_tokens: 4096,
      is_moderated: true
    },
    per_request_limits: {
      prompt_tokens: '128000',
      completion_tokens: '4096'
    }
  },
  'anthropic/claude-3.5-sonnet': {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (Analysis Only)',
    description: 'Excellent for detailed image analysis - no generation',
    pricing: {
      prompt: '$3.00',
      completion: '$15.00'
    },
    context_length: 200000,
    architecture: {
      modality: 'text+vision',
      tokenizer: 'claude',
      instruct_type: null
    },
    top_provider: {
      context_length: 200000,
      max_completion_tokens: 8192,
      is_moderated: true
    },
    per_request_limits: {
      prompt_tokens: '200000',
      completion_tokens: '8192'
    }
  },
  'google/gemini-pro-vision': {
    id: 'google/gemini-pro-vision',
    name: 'Gemini Pro Vision (Analysis Only)',
    description: 'Fast and accurate image analysis - no generation',
    pricing: {
      prompt: '$0.50',
      completion: '$1.50'
    },
    context_length: 30720,
    architecture: {
      modality: 'text+vision',
      tokenizer: 'gemini',
      instruct_type: null
    },
    top_provider: {
      context_length: 30720,
      max_completion_tokens: 2048,
      is_moderated: true
    },
    per_request_limits: {
      prompt_tokens: '30720',
      completion_tokens: '2048'
    }
  }
};

export function getModelDisplayName(modelId: string): string {
  // Extract readable name from model ID
  if (modelId.includes('/')) {
    const parts = modelId.split('/');
    const modelName = parts[parts.length - 1];
    return modelName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  return AVAILABLE_MODELS[modelId]?.name || modelId;
}

export function getModelPricing(modelId: string): string {
  const model = AVAILABLE_MODELS[modelId];
  if (!model) return 'Unknown';
  
  const promptPrice = parseFloat(model.pricing.prompt.replace('$', ''));
  const completionPrice = parseFloat(model.pricing.completion.replace('$', ''));
  const avgPrice = (promptPrice + completionPrice) / 2;
  
  return `$${avgPrice.toFixed(3)}/request`;
}
