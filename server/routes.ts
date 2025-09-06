import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { 
  insertConversationSchema, 
  insertMessageSchema, 
  insertImageProcessingJobSchema,
  insertModelConfigurationSchema,
  insertSavedImageSchema 
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage.js";
import { ObjectPermission } from "./objectAcl.js";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Setup multer for temporary file uploads (before S3 upload)
const uploadDir = path.join(process.cwd(), 'temp_uploads');
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

// Initialize object storage service
const objectStorageService = new ObjectStorageService();

// Helper function to save generated images to S3 object storage
async function saveGeneratedImageToS3(imageData: any, prompt: string): Promise<string> {
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
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Upload directly to S3 (no fallbacks)
    console.log('[SaveImage] Uploading generated image to S3...');
    const objectPath = await objectStorageService.uploadToS3(
      buffer,
      filename,
      'image/png'
    );
    
    // Set ACL policy for public access if using S3 (generated images are public)
    if (objectPath.startsWith('/objects/')) {
      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: 'system', // System-generated images
        visibility: 'public',
      });
    }
    
    console.log(`[SaveImage] Generated image saved to S3: ${objectPath}`);
    return objectPath;
    
  } catch (error) {
    console.error('[SaveImage] Error saving generated image to S3:', error);
    throw error;
  }
}

// Legacy function for backward compatibility
async function saveGeneratedImage(imageData: any, prompt: string): Promise<string> {
  return saveGeneratedImageToS3(imageData, prompt);
}


// New function to process with failover sequence
async function processImageWithFailover(
  imageUrl: string,
  prompt: string,
  modelConfig: any,
  timeoutSeconds: number = 120
): Promise<{ processedImageUrl: string; enhancementsApplied: string[]; processingTime: number; modelUsed: string }> {
  const startTime = Date.now();
  
  console.log(`[Failover] Starting image processing with failover sequence`);
  
  // Get enabled models in priority order
  const modelPriorities = (modelConfig?.modelPriorities || [])
    .filter((item: any) => item.enabled)
    .sort((a: any, b: any) => a.priority - b.priority);
  
  // If no models configured in priorities, fallback to selectedModel
  if (modelPriorities.length === 0) {
    const fallbackModel = modelConfig?.selectedModel || 'google/gemini-2.5-flash-image';
    console.log(`[Failover] No model priorities configured, using fallback: ${fallbackModel}`);
    const result = await processImageWithOpenRouter(imageUrl, prompt, fallbackModel, modelConfig?.apiKey, timeoutSeconds);
    return { ...result, modelUsed: fallbackModel };
  }
  
  console.log(`[Failover] Found ${modelPriorities.length} enabled models in sequence:`, modelPriorities.map((m: any) => `${m.priority}. ${m.model}`));
  
  let lastError: Error | null = null;
  
  // Try each model in priority order
  for (const modelItem of modelPriorities) {
    try {
      console.log(`[Failover] Attempting model: ${modelItem.model} (priority ${modelItem.priority})`);
      const result = await processImageWithOpenRouter(imageUrl, prompt, modelItem.model, modelConfig?.apiKey, timeoutSeconds);
      console.log(`[Failover] Success with model: ${modelItem.model}`);
      return { ...result, modelUsed: modelItem.model };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[Failover] Model ${modelItem.model} failed: ${errorMessage}`);
      lastError = error instanceof Error ? error : new Error(errorMessage);
      
      // Continue to next model in sequence
      continue;
    }
  }
  
  // All models failed
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`[Failover] All ${modelPriorities.length} models failed after ${totalTime}s`);
  throw new Error(`All ${modelPriorities.length} configured models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

async function processImageWithOpenRouter(
  imageUrl: string, 
  prompt: string, 
  model: string,
  apiKey?: string,
  timeoutSeconds: number = 120
): Promise<{ processedImageUrl: string; enhancementsApplied: string[]; processingTime: number }> {
  const startTime = Date.now();
  
  console.log(`[Processing] Model: ${model}, Prompt: "${prompt}", Timeout: ${timeoutSeconds}s`);
  
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

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutSeconds * 1000);

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
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
          generatedImageUrl = await saveGeneratedImageToS3(imageDataUrl, prompt);
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
    
    // Create AbortController for timeout (vision models)
    const visionController = new AbortController();
    const visionTimeoutId = setTimeout(() => {
      visionController.abort();
    }, timeoutSeconds * 1000);

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
      }),
      signal: visionController.signal
    });
    
    clearTimeout(visionTimeoutId);

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
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    console.error('[Processing] Error:', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutSeconds} seconds`);
    }
    
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware setup
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get all conversations for authenticated user
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch conversations" 
      });
    }
  });

  // Create a new conversation (requires authentication)
  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      // More defensive access to user ID
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      console.log('[Conversation] Creating for user:', userId, 'Body:', req.body);
      
      const validatedData = insertConversationSchema.parse({...req.body, userId});
      const conversation = await storage.createConversation(validatedData);
      res.status(201).json(conversation);
    } catch (error) {
      console.error('[Conversation] Creation error:', error);
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
  
  // Get conversation with full message history and context (requires authentication)
  app.get("/api/conversations/:id/context", isAuthenticated, async (req, res) => {
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
      const recentConversations = await storage.getRecentConversationsWithMessages(undefined, limit);
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

  // Alternative endpoint for conversation history
  app.get("/api/conversations/history", isAuthenticated, async (req: any, res) => {
    try {
      // Use authenticated user ID, fallback to 'default' for compatibility
      const userId = req.user?.claims?.sub || req.user?.id || req.query.userId as string || "default";
      console.log('[Conversation History] Fetching for user:', userId);
      const conversationHistory = await storage.getUserConversationHistory(userId);
      console.log('[Conversation History] Found conversations:', conversationHistory.length);
      res.json(conversationHistory);
    } catch (error) {
      console.error('[Conversation History] Error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch user conversation history" 
      });
    }
  });

  // Object storage upload endpoint - get presigned URL
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to get upload URL" 
      });
    }
  });

  // Process uploaded file and set ACL policy
  app.put("/api/objects/process-upload", async (req, res) => {
    try {
      const { uploadURL, userId = 'anonymous' } = req.body;
      
      if (!uploadURL) {
        return res.status(400).json({ error: "uploadURL is required" });
      }
      
      // Set ACL policy for the uploaded image
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: userId,
          visibility: "public", // Uploaded images are public for processing
        }
      );
      
      res.json({ objectPath });
    } catch (error) {
      console.error('Error processing upload:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process upload" 
      });
    }
  });

  // Legacy upload endpoint for backward compatibility
  app.post("/api/upload", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      console.log('File upload started:', {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // Read the uploaded file
      const fileBuffer = fs.readFileSync(req.file.path);
      
      // Upload directly to S3 (no fallbacks)
      console.log('Starting S3 upload...');
      const objectPath = await objectStorageService.uploadToS3(
        fileBuffer, 
        req.file.originalname,
        req.file.mimetype
      );
      
      // Set ACL policy for public access (if using S3)
      if (objectPath.startsWith('/objects/')) {
        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
          owner: 'user',
          visibility: 'public',
        });
      }
      
      // Clean up temporary file
      fs.unlinkSync(req.file.path);
      
      res.json({ 
        imageUrl: objectPath,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (error) {
      console.error('Error in legacy upload:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to upload image" 
      });
    }
  });

  // Serve images from object storage
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: undefined, // For now, allow public access - can be extended with auth
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Serve local uploads (fallback storage)
  app.get("/uploads/:fileName", (req, res) => {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Serve the file
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving local file:", error);
      return res.sendStatus(500);
    }
  });

  // Serve public objects (backward compatibility for existing assets)
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Legacy image serving endpoint
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
  app.post("/api/process-image", isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId, imageUrl, prompt } = req.body;
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      console.log('[Processing] Request from user:', userId);
      
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

      // Get model configuration for the authenticated user
      const modelConfig = await storage.getModelConfiguration(userId);
      console.log('[Processing] Model config retrieved:', JSON.stringify(modelConfig, null, 2));
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
      
      console.log('[Processing] Created job:', processingJob.id);

      res.json({ 
        userMessage, 
        aiMessage, 
        processingJob 
      });

      // Process image asynchronously
      setImmediate(async () => {
        try {
          console.log('[Processing] Starting async processing for job:', processingJob.id);
          
          // Get timeout configuration
          const timeoutSeconds = modelConfig?.timeout || 120;
          const result = await processImageWithFailover(finalImageUrl, prompt, modelConfig, timeoutSeconds);
          
          console.log('[Processing] Failover completed, updating job:', processingJob.id);
          
          // Update processing job (include model used)
          await storage.updateImageProcessingJob(processingJob.id, {
            status: 'completed',
            processedImageUrl: result.processedImageUrl,
            processingTime: result.processingTime,
            enhancementsApplied: result.enhancementsApplied,
            model: result.modelUsed // Update the model field with the actually used model
          });

          console.log('[Processing] Job updated successfully:', processingJob.id);

          // Update AI message
          await storage.updateMessage(aiMessage.id, {
            content: `✨ Image enhanced successfully`,
            imageUrl: result.processedImageUrl, // Add the processed image URL for before/after comparison
            processingStatus: 'completed'
          });

          console.log('[Processing] Message updated successfully for job:', processingJob.id);

        } catch (error) {
          console.error('[Processing] Error during async processing:', error);
          
          try {
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
            
            console.log('[Processing] Error status updated for job:', processingJob.id);
          } catch (updateError) {
            console.error('[Processing] Failed to update error status:', updateError);
          }
        }
      });

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

  // Get model configuration (admin only)
  app.get("/api/model-config", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      console.log('[Config] Loading for user:', userId);
      
      const config = await storage.getModelConfiguration(userId);
      console.log('[Config] Loaded from database:', config);
      
      // Create proper default configuration with Google Gemini models
      const defaultConfig = {
        selectedModel: 'google/gemini-2.5-flash-image-preview:free',
        outputQuality: 'high',
        maxResolution: 4096,
        timeout: 120,
        apiKeyConfigured: process.env.OPENROUTER_API_KEY ? 'true' : 'false',
        modelPriorities: [
          { model: 'google/gemini-2.5-flash-image-preview:free', priority: 1, enabled: true },
          { model: 'google/gemini-2.5-flash-image', priority: 2, enabled: true },
          { model: 'google/gemini-2.5-flash-image-preview', priority: 3, enabled: true }
        ]
      };
      
      // If we have saved config, merge it with defaults and include the API key
      if (config) {
        const mergedConfig = {
          ...defaultConfig,
          ...config,
          // Ensure apiKeyConfigured is set based on whether we have an API key
          apiKeyConfigured: config.apiKey ? 'true' : (process.env.OPENROUTER_API_KEY ? 'true' : 'false')
        };
        console.log('[Config] Returning merged config:', { ...mergedConfig, apiKey: mergedConfig.apiKey ? '***HIDDEN***' : 'none' });
        res.json(mergedConfig);
      } else {
        console.log('[Config] Returning default config');
        res.json(defaultConfig);
      }
    } catch (error) {
      console.error('[Config] Load error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch model configuration" 
      });
    }
  });

  // Update model configuration (admin only)
  app.post("/api/model-config", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // More defensive access to user ID
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      console.log('[Config] Saving for user:', userId, 'Data:', req.body);
      
      const validatedData = insertModelConfigurationSchema.parse({...req.body, userId});
      const config = await storage.createOrUpdateModelConfiguration(validatedData);
      res.json(config);
    } catch (error) {
      console.error('[Config] Save error:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to update model configuration" 
      });
    }
  });

  // Fetch available models from OpenRouter (admin only)
  app.get("/api/models", isAuthenticated, isAdmin, async (req: any, res) => {
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

  // Save generated image to user library
  app.post("/api/library/save", isAuthenticated, async (req: any, res) => {
    try {
      // Get user ID from authenticated session
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      
      // Override any userId in the request body with the authenticated user ID
      const requestData = { ...req.body, userId };
      const validatedData = insertSavedImageSchema.parse(requestData);
      
      console.log('Saving image to library for user:', userId);
      const savedImage = await storage.createSavedImage(validatedData);
      res.json(savedImage);
    } catch (error) {
      console.error('Error saving image to library:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to save image to library" 
      });
    }
  });

  // Get user's saved images
  app.get("/api/library/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = '1', limit = '20', tags } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const tagsArray = tags ? (tags as string).split(',') : undefined;
      
      const savedImages = await storage.getUserSavedImages(userId, {
        page: pageNum,
        limit: limitNum,
        tags: tagsArray
      });
      
      res.json(savedImages);
    } catch (error) {
      console.error('Error fetching user library:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch user library" 
      });
    }
  });

  // Delete saved image from library
  app.delete("/api/library/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }
      
      const success = await storage.deleteSavedImage(imageId, userId as string);
      
      if (!success) {
        return res.status(404).json({ message: "Image not found or not authorized" });
      }
      
      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error('Error deleting saved image:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete saved image" 
      });
    }
  });

  // Get saved image details
  app.get("/api/library/image/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const savedImage = await storage.getSavedImage(imageId);
      
      if (!savedImage) {
        return res.status(404).json({ message: "Saved image not found" });
      }
      
      res.json(savedImage);
    } catch (error) {
      console.error('Error fetching saved image details:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch saved image details" 
      });
    }
  });

  // Upload endpoint for canvas images from editor using object storage service
  app.post("/api/upload-image", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const uploadedFile = req.file;
      
      console.log('[UploadImage] Processing canvas image upload...');
      
      // Step 1: Get presigned upload URL from object storage service
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log('[UploadImage] Got presigned URL');

      // Step 2: Upload file to presigned URL
      const fs = await import('fs');
      const formData = new FormData();
      const fileBuffer = fs.readFileSync(uploadedFile.path);
      const blob = new Blob([fileBuffer], { type: 'image/png' });
      
      console.log('[UploadImage] Uploading to presigned URL...');
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'image/png',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      console.log('[UploadImage] Upload successful');

      // Step 3: Set ACL policy for the uploaded object
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: 'system',
          visibility: 'public'
        }
      );

      // Clean up temporary file
      fs.unlinkSync(uploadedFile.path);

      res.json({ imageUrl: objectPath });
    } catch (error) {
      console.error('Error uploading canvas image:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to upload image" 
      });
    }
  });

  // Get enabled prompt templates for quick actions (accessible to all authenticated users)
  app.get("/api/prompt-templates", async (req: any, res) => {
    try {
      const templates = await storage.getEnabledPromptTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching prompt templates:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch prompt templates" 
      });
    }
  });

  // Get all prompt templates for admin (including disabled ones)
  app.get("/api/admin/prompt-templates", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const templates = await storage.getPromptTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching all prompt templates:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch all prompt templates" 
      });
    }
  });

  // Create prompt template (admin only)
  app.post("/api/prompt-templates", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const template = await storage.createPromptTemplate(req.body);
      res.json(template);
    } catch (error) {
      console.error('Error creating prompt template:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create prompt template" 
      });
    }
  });

  // Update prompt template (admin only)
  app.put("/api/prompt-templates/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const template = await storage.updatePromptTemplate(id, req.body);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Error updating prompt template:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to update prompt template" 
      });
    }
  });

  // Delete prompt template (admin only)
  app.delete("/api/prompt-templates/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deletePromptTemplate(id);
      
      if (!success) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error('Error deleting prompt template:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete prompt template" 
      });
    }
  });

  // Increment template usage
  app.post("/api/prompt-templates/:id/usage", async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.incrementTemplateUsage(id);
      res.json({ message: "Usage incremented" });
    } catch (error) {
      console.error('Error incrementing template usage:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to increment usage" 
      });
    }
  });

  // Enhance template with LLM
  app.post("/api/enhance-template", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { template } = req.body;
      
      if (!template) {
        return res.status(400).json({ message: "Template content is required" });
      }

      // Get the current model configuration
      const config = await storage.getModelConfiguration(req.user?.claims?.sub || 'admin');
      
      if (!config.apiKey) {
        return res.status(400).json({ message: "OpenRouter API key not configured" });
      }

      // Call OpenRouter API to enhance the template
      const enhancePrompt = `You are an expert at creating image processing prompts. Please enhance and improve the following prompt template to make it more specific, detailed, and effective for AI image processing. Keep any existing variable placeholders like {variable}.

Original prompt: ${template}

Enhanced prompt:`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.REPLIT_DOMAINS || 'http://localhost:5000',
          'X-Title': 'AI Product Studio - Template Enhancement'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: enhancePrompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const result = await response.json();
      const enhancedTemplate = result.choices[0]?.message?.content || template;

      res.json({ enhancedTemplate: enhancedTemplate.trim() });
    } catch (error) {
      console.error('Error enhancing template:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to enhance template" 
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
      objectStorageConfigured: !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID,
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
