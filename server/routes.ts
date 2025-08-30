import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertConversationSchema, 
  insertMessageSchema, 
  insertImageProcessingJobSchema,
  insertModelConfigurationSchema 
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Setup multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
    }
  },
});

// Helper function to save generated images from base64 data
async function saveGeneratedImage(imageData: any, prompt: string): Promise<string> {
  try {
    let base64Data: string;
    
    // Handle different image data formats
    if (imageData.b64_json) {
      base64Data = imageData.b64_json;
    } else if (imageData.url && imageData.url.startsWith('data:image/')) {
      // Extract base64 from data URL
      base64Data = imageData.url.split(',')[1];
    } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      base64Data = imageData.split(',')[1];
    } else {
      console.log('[SaveImage] Unsupported image data format:', imageData);
      throw new Error('Unsupported image data format');
    }
    
    // Generate unique filename
    const hash = crypto.createHash('md5').update(base64Data + prompt).digest('hex');
    const filename = `enhanced_${hash}.png`;
    const filepath = path.join(uploadDir, filename);
    
    // Save base64 data to file
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filepath, buffer);
    
    console.log(`[SaveImage] Generated image saved: ${filename}`);
    return `/api/images/${filename}`;
    
  } catch (error) {
    console.error('[SaveImage] Error saving generated image:', error);
    throw error;
  }
}


async function processImageWithOpenRouter(
  imageUrl: string, 
  prompt: string, 
  model: string,
  apiKey?: string
): Promise<{ processedImageUrl: string; enhancementsApplied: string[]; processingTime: number }> {
  const startTime = Date.now();
  
  console.log(`[Processing] Model: ${model}, Prompt: "${prompt}"`);
  
  try {
    const keyToUse = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
    
    if (!keyToUse) {
      throw new Error('OpenRouter API key not configured');
    }

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    const baseUrl = domain ? `https://${domain}` : 'http://localhost:5000';
    const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;
    
    // Check if this is Gemini 2.5 Flash Image (image generation model)
    if (model.includes('google/gemini-2.5-flash-image-preview')) {
      console.log('[Processing] Using Gemini 2.5 Flash Image for image generation');
      console.log('[Debug] Image URL being sent:', fullImageUrl);
      
      // Use a highly specific prompt for product image enhancement (not generation)
      const generationPrompt = `IMPORTANT: You are editing/enhancing the EXACT product shown in this image. DO NOT create a new product. DO NOT replace the product. 

Your task: ${prompt}

Rules you MUST follow:
1. Keep the EXACT same product/device/object from the uploaded image
2. Preserve the product's shape, design, colors, and features exactly as shown
3. Only modify the background, lighting, environment, or apply effects around the product
4. The product itself should remain identical to the original
5. If asked to change the product's appearance, only make subtle enhancements while keeping its core identity
6. Focus on enhancing the scene around the product, not replacing it

This is product image enhancement, not product generation. Work with what's provided.`;
      
      console.log('[Debug] Generation prompt:', generationPrompt);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': baseUrl,
          'X-Title': 'AI Image Editor'
        },
        body: JSON.stringify({
          model,
          modalities: ["image", "text"], // REQUIRED for image generation
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: generationPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: fullImageUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 4000
        })
      });
      
      console.log('[Debug] Request sent to OpenRouter with image URL and prompt');

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Gemini] API Error: ${errorBody}`);
        throw new Error(`Gemini 2.5 Flash Image generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[Gemini] Full Response:', JSON.stringify(result, null, 2));
      
      const choice = result.choices?.[0];
      const message = choice?.message;
      
      let generatedImageUrl = imageUrl; // Default to original
      let enhancementsApplied = ['Image generation attempted'];
      
      // Check for generated images in the correct field (OpenRouter format)
      if (message?.images && Array.isArray(message.images)) {
        console.log('[Gemini] Found generated images:', message.images.length);
        // Take the first generated image - OpenRouter format has image_url.url structure
        const imageObject = message.images[0];
        const imageDataUrl = imageObject?.image_url?.url || imageObject?.url || imageObject;
        
        if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
          generatedImageUrl = await saveGeneratedImage(imageDataUrl, prompt);
          enhancementsApplied = [`Generated enhanced image with Gemini 2.5 Flash: ${prompt}`];
          console.log('[Gemini] Successfully saved generated image');
        } else {
          console.log('[Gemini] Image found but not in expected format:', imageObject);
        }
      } else {
        console.log('[Gemini] No images found in response');
        console.log('[Gemini] Available message fields:', Object.keys(message || {}));
        if (message?.content) {
          enhancementsApplied = [`Gemini Response: ${message.content}`];
        }
      }

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      
      return {
        processedImageUrl: generatedImageUrl,
        enhancementsApplied,
        processingTime
      };
    }
    
    // For vision models (analysis only)
    console.log('[Processing] Using vision model for analysis only');
    
    const analysisPrompt = `Analyze this image and provide detailed suggestions for: ${prompt}. Explain what changes could be made to achieve this effect, but note that this is analysis only - no actual image generation will occur.`;
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyToUse}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': baseUrl,
        'X-Title': 'AI Image Editor'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: analysisPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: fullImageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Vision model analysis failed: ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    const analysis = result.choices?.[0]?.message?.content || 'No analysis provided';
    
    return {
      processedImageUrl: imageUrl, // Return original image (no generation)
      enhancementsApplied: [`Analysis: ${analysis}`],
      processingTime
    };
    
  } catch (error) {
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all conversations
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch conversations" 
      });
    }
  });

  // Create a new conversation
  app.post("/api/conversations", async (req, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      res.status(201).json(conversation);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to create conversation" 
      });
    }
  });

  // Get messages for a conversation
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const messages = await storage.getMessagesByConversation(id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch messages" 
      });
    }
  });

  // User Context API endpoints - 用户上下文功能
  
  // Get conversation with full message history and context
  app.get("/api/conversations/:id/context", async (req, res) => {
    try {
      const { id } = req.params;
      const conversationWithMessages = await storage.getConversationWithMessages(id);
      
      if (!conversationWithMessages) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      res.json(conversationWithMessages);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch conversation context" 
      });
    }
  });

  // Get recent conversations with messages for user context
  app.get("/api/conversations/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const recentConversations = await storage.getRecentConversationsWithMessages(limit);
      res.json(recentConversations);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch recent conversations" 
      });
    }
  });

  // Get user conversation history with full context
  app.get("/api/user/conversations", async (req, res) => {
    try {
      const userId = req.query.userId as string || "default";
      const conversationHistory = await storage.getUserConversationHistory(userId);
      res.json(conversationHistory);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch user conversation history" 
      });
    }
  });

  // Upload image endpoint
  app.post("/api/upload", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Generate URL for the uploaded file
      const imageUrl = `/api/images/${req.file.filename}`;
      
      res.json({ 
        imageUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to upload image" 
      });
    }
  });

  // Serve uploaded images
  app.get("/api/images/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "Image not found" });
    }
  });

  // Process image with AI
  app.post("/api/process-image", async (req, res) => {
    try {
      const { conversationId, imageUrl, prompt } = req.body;
      
      if (!conversationId || !prompt) {
        return res.status(400).json({ 
          message: "Missing required fields: conversationId, prompt" 
        });
      }

      // If no imageUrl provided, get the latest image from conversation context
      let finalImageUrl = imageUrl;
      if (!finalImageUrl) {
        finalImageUrl = await storage.getLatestImageFromConversation(conversationId);
        if (!finalImageUrl) {
          return res.status(400).json({ 
            message: "No image found in conversation context. Please upload an image first." 
          });
        }
      }

      // Get model configuration
      const modelConfig = await storage.getModelConfiguration();
      const selectedModel = modelConfig?.selectedModel || 'gpt-4-vision';

      // Create user message (only include imageUrl if it's a new upload)
      const userMessage = await storage.createMessage({
        conversationId,
        role: 'user',
        content: prompt,
        imageUrl: imageUrl || null, // Only set if new image was uploaded
        processingStatus: 'completed'
      });

      // Create AI message placeholder
      const aiMessage = await storage.createMessage({
        conversationId,
        role: 'assistant',
        content: 'Processing your image...',
        processingStatus: 'processing'
      });

      // Create processing job
      const processingJob = await storage.createImageProcessingJob({
        messageId: aiMessage.id,
        originalImageUrl: finalImageUrl, // Use the resolved image URL
        prompt,
        model: selectedModel,
        status: 'processing'
      });

      res.json({ 
        userMessage, 
        aiMessage, 
        processingJob 
      });

      // Process image asynchronously
      try {
        // Get user's API key if available
        const userApiKey = modelConfig?.apiKey || undefined;
        const result = await processImageWithOpenRouter(finalImageUrl, prompt, selectedModel, userApiKey);
        
        // Update processing job
        await storage.updateImageProcessingJob(processingJob.id, {
          status: 'completed',
          processedImageUrl: result.processedImageUrl,
          processingTime: result.processingTime,
          enhancementsApplied: result.enhancementsApplied
        });

        // Update AI message
        await storage.updateMessage(aiMessage.id, {
          content: `I've successfully enhanced your image! Here are the improvements I applied:\n\n${result.enhancementsApplied.map(e => `• ${e}`).join('\n')}`,
          imageUrl: result.processedImageUrl, // Add the processed image URL for before/after comparison
          processingStatus: 'completed'
        });

      } catch (error) {
        // Update processing job with error
        await storage.updateImageProcessingJob(processingJob.id, {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });

        // Update AI message with error
        await storage.updateMessage(aiMessage.id, {
          content: `Sorry, I encountered an error while processing your image: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processingStatus: 'error'
        });
      }

    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process image" 
      });
    }
  });

  // Get processing job status
  app.get("/api/processing-jobs/:messageId", async (req, res) => {
    try {
      const { messageId } = req.params;
      const job = await storage.getImageProcessingJobByMessage(messageId);
      
      if (!job) {
        return res.status(404).json({ message: "Processing job not found" });
      }

      res.json(job);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch processing job" 
      });
    }
  });

  // Get model configuration
  app.get("/api/model-config", async (req, res) => {
    try {
      const config = await storage.getModelConfiguration();
      res.json(config || {
        selectedModel: 'gpt-4-vision',
        outputQuality: 'high',
        maxResolution: 2048,
        timeout: 120,
        apiKeyConfigured: process.env.OPENROUTER_API_KEY ? 'true' : 'false'
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch model configuration" 
      });
    }
  });

  // Update model configuration
  app.post("/api/model-config", async (req, res) => {
    try {
      const validatedData = insertModelConfigurationSchema.parse(req.body);
      const config = await storage.createOrUpdateModelConfiguration(validatedData);
      res.json(config);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to update model configuration" 
      });
    }
  });

  // Fetch available models from OpenRouter
  app.get("/api/models", async (req, res) => {
    try {
      const { apiKey } = req.query;
      const keyToUse = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
      
      if (!keyToUse) {
        return res.status(400).json({ 
          message: "API key is required. Please provide it in the query parameter or set OPENROUTER_API_KEY environment variable" 
        });
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000',
          'X-Title': 'AI Image Editor'
        }
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Filter for models that support vision/multimodal capabilities
      const visionModels = result.data?.filter((model: any) => 
        model.architecture?.modality?.includes('vision') || 
        model.architecture?.modality?.includes('multimodal') ||
        model.id?.includes('vision') ||
        model.id?.includes('gpt-4') ||
        model.id?.includes('claude') ||
        model.id?.includes('gemini')
      ) || [];
      
      res.json({
        data: visionModels,
        total: visionModels.length,
        apiKeyValid: true
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch models",
        apiKeyValid: false
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
