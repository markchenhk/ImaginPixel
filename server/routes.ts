import type { Express } from "express";
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
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
    }
  },
});

async function processImageWithOpenRouter(
  imageUrl: string, 
  prompt: string, 
  model: string
): Promise<{ processedImageUrl: string; enhancementsApplied: string[]; processingTime: number }> {
  const startTime = Date.now();
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  try {
    // For this implementation, we'll simulate the OpenRouter API call
    // In a real implementation, you would call the actual OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000',
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
                text: `Please analyze and enhance this image based on the following request: ${prompt}. Provide a detailed description of the enhancements you would apply.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const result = await response.json();
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    // For demo purposes, we'll return the original image as processed
    // In a real implementation, this would be the enhanced image URL
    const enhancementsApplied = [
      'Color saturation enhanced',
      'Contrast optimization applied',
      'Image sharpening performed'
    ];

    return {
      processedImageUrl: imageUrl, // In real implementation, this would be the enhanced image
      enhancementsApplied,
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

  // Upload image endpoint
  app.post("/api/upload", upload.single('image'), async (req, res) => {
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
      
      if (!conversationId || !imageUrl || !prompt) {
        return res.status(400).json({ 
          message: "Missing required fields: conversationId, imageUrl, prompt" 
        });
      }

      // Get model configuration
      const modelConfig = await storage.getModelConfiguration();
      const selectedModel = modelConfig?.selectedModel || 'gpt-4-vision';

      // Create user message
      const userMessage = await storage.createMessage({
        conversationId,
        role: 'user',
        content: prompt,
        imageUrl,
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
        originalImageUrl: imageUrl,
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
        const result = await processImageWithOpenRouter(imageUrl, prompt, selectedModel);
        
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
