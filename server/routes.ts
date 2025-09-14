import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { 
  insertConversationSchema, 
  insertMessageSchema, 
  insertImageProcessingJobSchema,
  insertVideoProcessingJobSchema,
  insertModelConfigurationSchema,
  insertSavedImageSchema,
  insertApplicationFunctionSchema,
  insertPromptTemplateSchema 
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage.js";
import { ObjectPermission } from "./objectAcl.js";
// @ts-ignore - FFmpeg types are installed but may not be loading properly
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

// Configure ffmpeg with the static binary path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// AI Video Plan parsing interface
interface AiVideoPlan {
  description: string;
  cameraMovements: string[];
  visualEffects: string[];
  textOverlays: string[];
  duration: number;
  marketingAngle: string;
}

// Video generation provider interface
interface IVideoProvider {
  generate(params: {
    imageUrl: string;
    prompt: string;
    duration: number;
    model: string;
    apiKey?: string;
  }): Promise<{
    videoUrl: string;
    processingTime: number;
    enhancementsApplied: string[];
    providerUsed: string;
    modelUsed: string;
  }>;
}

interface VideoGenerationResult {
  processedVideoUrl: string;
  enhancementsApplied: string[];
  videoDuration: number;
  processingTime: number;
  providerUsed: string;
  modelUsed: string;
}

// OpenRouter Video Provider - Real video generation using AI models
class OpenRouterVideoProvider implements IVideoProvider {
  async generate(params: {
    imageUrl: string;
    prompt: string;
    duration: number;
    model: string;
    apiKey?: string;
  }): Promise<{
    videoUrl: string;
    processingTime: number;
    enhancementsApplied: string[];
    providerUsed: string;
    modelUsed: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Check if model supports video generation
      if (!await this.supportsVideoGeneration(params.model, params.apiKey)) {
        throw new Error(`Model ${params.model} does not support video generation`);
      }
      
      const keyToUse = params.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
      if (!keyToUse) {
        throw new Error('OpenRouter API key not configured');
      }

      const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
      const baseUrl = domain ? `https://${domain}` : 'http://localhost:5000';
      
      // Try video generation endpoint (experimental)
      const videoResponse = await this.generateVideo(params.imageUrl, params.prompt, params.duration, params.model, keyToUse, baseUrl);
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      
      return {
        videoUrl: videoResponse.videoUrl,
        processingTime,
        enhancementsApplied: [`Real video generated with ${params.model}`, ...videoResponse.enhancementsApplied],
        providerUsed: 'OpenRouter Video AI',
        modelUsed: params.model
      };
      
    } catch (error) {
      console.warn('[OpenRouter Video] Generation failed:', error);
      throw error;
    }
  }
  
  private async supportsVideoGeneration(model: string, apiKey?: string): Promise<boolean> {
    try {
      const keyToUse = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
      if (!keyToUse) return false;
      
      // Check if model supports video modality
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      const modelInfo = data.data?.find((m: any) => m.id === model);
      
      // Check if model supports video generation
      return modelInfo?.architecture?.modality?.includes('video') || 
             modelInfo?.capabilities?.includes('video_generation') ||
             model.includes('video') ||
             model.includes('runway') ||
             model.includes('pika') ||
             model.includes('luma');
             
    } catch (error) {
      console.warn('[OpenRouter Video] Could not check model capabilities:', error);
      return false;
    }
  }
  
  private async generateVideo(imageUrl: string, prompt: string, duration: number, model: string, apiKey: string, baseUrl: string): Promise<{
    videoUrl: string;
    enhancementsApplied: string[];
  }> {
    // For now, return error as we need to research actual video API endpoints
    throw new Error('Video generation API endpoint not yet implemented - OpenRouter video models need research');
  }
}

// Ken Burns Provider - Fallback using existing FFmpeg approach
class KenBurnsProvider implements IVideoProvider {
  async generate(params: {
    imageUrl: string;
    prompt: string;
    duration: number;
    model: string;
    apiKey?: string;
  }): Promise<{
    videoUrl: string;
    processingTime: number;
    enhancementsApplied: string[];
    providerUsed: string;
    modelUsed: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('[Ken Burns] Generating video with motion effects');
      
      // Generate real video using FFmpeg Ken Burns effects
      const tempDir = path.join(process.cwd(), 'temp_videos');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const videoFilename = `video_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
      const tempVideoPath = path.join(tempDir, videoFilename);
      
      // Use existing generateVideoFromImage function which generates to tempVideoPath
      await generateVideoFromImage(params.imageUrl, params.prompt, tempVideoPath);
      
      // Upload to S3
      const objectStorage = new ObjectStorageService();
      const videoBuffer = await fs.promises.readFile(tempVideoPath);
      const s3Path = await objectStorage.uploadToS3(videoBuffer, videoFilename, 'video/mp4');
      
      // Clean up temp file
      try {
        await fs.promises.unlink(tempVideoPath);
      } catch (err) {
        console.warn('[Ken Burns] Failed to clean up temp file:', err);
      }
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      
      return {
        videoUrl: s3Path,
        processingTime,
        enhancementsApplied: ['Ken Burns motion effects', 'AI-guided camera movements', 'FFmpeg video generation'],
        providerUsed: 'Ken Burns Effects',
        modelUsed: 'FFmpeg'
      };
      
    } catch (error) {
      console.error('[Ken Burns] Video generation failed:', error);
      throw error;
    }
  }
}

// Multi-Frame Real Video Provider - Creates actual video by generating multiple AI frames
class MultiFrameVideoProvider implements IVideoProvider {
  async generate(params: {
    imageUrl: string;
    prompt: string;
    duration: number;
    model: string;
    apiKey?: string;
  }): Promise<{
    videoUrl: string;
    processingTime: number;
    enhancementsApplied: string[];
    providerUsed: string;
    modelUsed: string;
  }> {
    const startTime = Date.now();
    console.log('[MultiFrame Video] Starting real video generation with multiple AI frames');
    
    try {
      const keyToUse = params.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
      if (!keyToUse) {
        throw new Error('OpenRouter API key required for multi-frame video generation');
      }

      const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
      const baseUrl = domain ? `https://${domain}` : 'http://localhost:5000';
      
      // Generate multiple camera perspectives
      const frameCount = Math.max(5, Math.ceil(params.duration / 2)); // Generate 5-8 frames depending on duration
      const frames = await this.generateMultipleFrames(params.imageUrl, params.prompt, frameCount, params.model, keyToUse, baseUrl);
      
      if (frames.length < 2) {
        throw new Error('Failed to generate enough frames for video creation');
      }
      
      // Create smooth video transitions between frames
      const videoUrl = await this.createVideoFromFrames(frames, params.duration);
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      
      return {
        videoUrl,
        processingTime,
        enhancementsApplied: [
          'Multi-frame AI generation',
          `Generated ${frames.length} unique camera perspectives`,
          'Smooth frame interpolation',
          'Real video sequence creation',
          `AI model: ${params.model}`
        ],
        providerUsed: 'Multi-Frame AI Video',
        modelUsed: params.model
      };
      
    } catch (error) {
      console.warn('[MultiFrame Video] Generation failed:', error);
      throw error;
    }
  }
  
  private async generateMultipleFrames(
    originalImageUrl: string,
    originalPrompt: string,
    frameCount: number,
    model: string,
    apiKey: string,
    baseUrl: string
  ): Promise<string[]> {
    console.log(`[MultiFrame Video] Generating ${frameCount} unique camera perspectives...`);
    
    const frames: string[] = [];
    const cameraAngles = [
      'slightly to the left angle',
      'slightly to the right angle', 
      'slightly elevated perspective',
      'slightly closer zoom',
      'slightly wider angle',
      'subtle rotation clockwise',
      'subtle rotation counterclockwise',
      'gentle forward movement perspective'
    ];
    
    // Use the existing processImageWithOpenRouter method that already works
    // This reuses the proven image generation pipeline
    for (let i = 0; i < frameCount; i++) {
      try {
        const angle = cameraAngles[i % cameraAngles.length];
        const framePrompt = `${originalPrompt}. Generate this scene from a ${angle}. Maintain the exact same objects, lighting, and style but show from this new camera perspective. Keep consistent positioning and proportions.`;
        
        console.log(`[MultiFrame Video] Generating frame ${i + 1}/${frameCount} with ${angle}...`);
        
        // Use the existing working image generation method
        const result = await processImageWithOpenRouter(originalImageUrl, framePrompt, model, apiKey);
        
        if (result.processedImageUrl) {
          frames.push(result.processedImageUrl);
          console.log(`[MultiFrame Video] Frame ${i + 1} generated successfully`);
        } else {
          console.warn(`[MultiFrame Video] Frame ${i + 1} generation returned no image`);
        }
        
        // Small delay to avoid rate limiting
        if (i < frameCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.warn(`[MultiFrame Video] Failed to generate frame ${i + 1}:`, error);
        continue;
      }
    }
    
    console.log(`[MultiFrame Video] Successfully generated ${frames.length}/${frameCount} frames`);
    return frames;
  }
  
  
  private async createVideoFromFrames(frameUrls: string[], duration: number): Promise<string> {
    console.log(`[MultiFrame Video] Creating video from ${frameUrls.length} frames with ${duration}s duration...`);
    
    if (!fs.existsSync('temp_videos')) {
      fs.mkdirSync('temp_videos', { recursive: true });
    }
    
    const videoId = `multiframe_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const framesDir = `temp_videos/frames_${videoId}`;
    const outputPath = `temp_videos/video_${videoId}.mp4`;
    
    try {
      // Create frames directory
      fs.mkdirSync(framesDir, { recursive: true });
      
      // Download and prepare frames (convert relative URLs to absolute)
      const framePaths: string[] = [];
      const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
      const baseUrl = domain ? `https://${domain}` : 'http://localhost:5000';
      
      for (let i = 0; i < frameUrls.length; i++) {
        const absoluteUrl = frameUrls[i].startsWith('http') ? frameUrls[i] : `${baseUrl}${frameUrls[i]}`;
        const frameResponse = await fetch(absoluteUrl);
        if (!frameResponse.ok) continue;
        
        const frameBuffer = Buffer.from(await frameResponse.arrayBuffer());
        const framePath = path.join(framesDir, `frame_${i.toString().padStart(4, '0')}.jpg`);
        await fs.promises.writeFile(framePath, frameBuffer);
        framePaths.push(framePath);
      }
      
      if (framePaths.length < 2) {
        throw new Error('Not enough frames downloaded for video creation');
      }
      
      // Calculate frame rate for smooth playback (use integer for reliability)
      const framesPerSecond = Math.max(2, Math.min(30, Math.round(framePaths.length / duration)));
      
      // Create video with smooth transitions and interpolation (remove shell quotes from filter)
      const ffmpegCommand = [
        'ffmpeg',
        '-framerate', framesPerSecond.toString(),
        '-i', path.join(framesDir, 'frame_%04d.jpg'),
        '-vf', `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:black,minterpolate=mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=30`,
        '-t', duration.toString(),
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-y',
        outputPath
      ];
      
      console.log('[MultiFrame Video] Starting FFmpeg with frame interpolation...');
      await this.runFFmpegCommand(ffmpegCommand);
      
      // Upload to S3
      const videoFilename = `multiframe_video_${videoId}.mp4`;
      const objectStorage = new ObjectStorageService();
      const videoBuffer = await fs.promises.readFile(outputPath);
      const s3VideoPath = await objectStorage.uploadToS3(videoBuffer, videoFilename, 'video/mp4');
      
      // Cleanup
      await this.cleanupTempFiles([outputPath, framesDir]);
      
      console.log('[MultiFrame Video] Video created successfully with real frame transitions');
      return s3VideoPath;
      
    } catch (error) {
      console.error('[MultiFrame Video] Video creation failed:', error);
      await this.cleanupTempFiles([outputPath, framesDir]);
      throw error;
    }
  }
  
  private async runFFmpegCommand(command: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use the configured ffmpeg-static path instead of assuming 'ffmpeg' is on PATH
      const ffmpegExecutable = ffmpegPath || 'ffmpeg';
      const actualCommand = [ffmpegExecutable, ...command.slice(1)];
      
      console.log('[MultiFrame Video] Running FFmpeg command:', actualCommand.join(' '));
      const process = spawn(actualCommand[0], actualCommand.slice(1));
      
      process.stderr.on('data', (data: Buffer) => {
        const message = data.toString();
        if (message.includes('frame=') || message.includes('time=')) {
          console.log('[MultiFrame Video] FFmpeg progress:', message.trim());
        }
      });
      
      process.stdout.on('data', (data: Buffer) => {
        console.log('[MultiFrame Video] FFmpeg stdout:', data.toString().trim());
      });
      
      process.on('error', (error: Error) => {
        console.error('[MultiFrame Video] FFmpeg process error:', error);
        reject(error);
      });
      
      process.on('close', (code: number | null) => {
        if (code === 0) {
          console.log('[MultiFrame Video] FFmpeg completed successfully');
          resolve();
        } else {
          console.error(`[MultiFrame Video] FFmpeg failed with exit code: ${code}`);
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });
    });
  }
  
  private async cleanupTempFiles(paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        if (fs.existsSync(filePath)) {
          const stat = await fs.promises.stat(filePath);
          if (stat.isDirectory()) {
            await fs.promises.rmdir(filePath, { recursive: true });
          } else {
            await fs.promises.unlink(filePath);
          }
        }
      } catch (error) {
        console.warn('[MultiFrame Video] Failed to cleanup:', filePath, error);
      }
    }
  }
}

// Video Provider Selection and Management
class VideoProviderManager {
  private openRouterProvider = new OpenRouterVideoProvider();
  private multiFrameProvider = new MultiFrameVideoProvider();
  private kenBurnsProvider = new KenBurnsProvider();
  
  async generateVideo(params: {
    imageUrl: string;
    prompt: string;
    duration: number;
    model: string;
    apiKey?: string;
    preferredMode?: 'real' | 'enhanced' | 'simple';
  }): Promise<{
    videoUrl: string;
    processingTime: number;
    enhancementsApplied: string[];
    providerUsed: string;
    modelUsed: string;
  }> {
    const providers = this.getProviderSequence(params.preferredMode);
    
    let lastError: Error | null = null;
    
    for (const provider of providers) {
      try {
        console.log(`[Video Provider] Attempting ${provider.constructor.name}...`);
        const result = await provider.generate(params);
        console.log(`[Video Provider] Success with ${result.providerUsed}`);
        return result;
      } catch (error) {
        console.warn(`[Video Provider] ${provider.constructor.name} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }
    
    throw new Error(`All video providers failed. Last error: ${lastError?.message}`);
  }
  
  private getProviderSequence(preferredMode?: 'real' | 'enhanced' | 'simple'): IVideoProvider[] {
    switch (preferredMode) {
      case 'real':
        // Try real video first, then multi-frame AI video, fallback to Ken Burns
        return [this.openRouterProvider, this.multiFrameProvider, this.kenBurnsProvider];
      case 'enhanced':
        // Use multi-frame AI video as primary, fallback to Ken Burns
        return [this.multiFrameProvider, this.kenBurnsProvider];
      case 'simple':
        // Only use Ken Burns
        return [this.kenBurnsProvider];
      default:
        // Default: try real video, then multi-frame AI video, fallback to Ken Burns
        return [this.openRouterProvider, this.multiFrameProvider, this.kenBurnsProvider];
    }
  }
}

function parseAiVideoPlan(analysis: string): AiVideoPlan | null {
  try {
    // Extract JSON from AI analysis
    const jsonMatch = analysis.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const aiData = JSON.parse(jsonMatch[1]);
      return {
        description: aiData.description || '',
        cameraMovements: aiData.cameraMovements || [],
        visualEffects: aiData.visualEffects || [],
        textOverlays: aiData.textOverlays || [],
        duration: aiData.duration || 10,
        marketingAngle: aiData.marketingAngle || ''
      };
    }
    return null;
  } catch (error) {
    console.warn('[Video Planning] Could not parse AI analysis JSON:', error);
    return null;
  }
}

function needsOfficeBackground(visualEffects: string[]): boolean {
  const officeKeywords = ['office', 'desk', 'workspace', 'professional', 'modern office', 'employee', 'background'];
  const effectsText = visualEffects.join(' ').toLowerCase();
  return officeKeywords.some(keyword => effectsText.includes(keyword));
}

function checkNeedsOfficeBackground(aiPlan: AiVideoPlan | null, originalPrompt: string): boolean {
  const officeKeywords = ['office', 'desk', 'workspace', 'professional', 'modern office', 'employee', 'background'];
  
  // Check original prompt first (most reliable)
  const promptLower = originalPrompt.toLowerCase();
  if (officeKeywords.some(keyword => promptLower.includes(keyword))) {
    console.log('[Scene Enhancement] Office background detected in original prompt');
    return true;
  }
  
  // Check AI plan if available
  if (aiPlan) {
    // Check visual effects
    if (aiPlan.visualEffects && needsOfficeBackground(aiPlan.visualEffects)) {
      console.log('[Scene Enhancement] Office background detected in AI visual effects');
      return true;
    }
    
    // Check description and marketing angle
    const allText = [aiPlan.description, aiPlan.marketingAngle].join(' ').toLowerCase();
    if (officeKeywords.some(keyword => allText.includes(keyword))) {
      console.log('[Scene Enhancement] Office background detected in AI description/marketing');
      return true;
    }
  }
  
  return false;
}

function parseAiVideoPlanFlexible(analysis: string): AiVideoPlan | null {
  try {
    // First try standard fenced JSON
    let jsonMatch = analysis.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonText = '';
    
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Try to find first balanced JSON object
      const jsonStart = analysis.indexOf('{');
      if (jsonStart !== -1) {
        let braceCount = 0;
        let jsonEnd = jsonStart;
        
        for (let i = jsonStart; i < analysis.length; i++) {
          if (analysis[i] === '{') braceCount++;
          if (analysis[i] === '}') braceCount--;
          if (braceCount === 0) {
            jsonEnd = i;
            break;
          }
        }
        
        if (braceCount === 0) {
          jsonText = analysis.substring(jsonStart, jsonEnd + 1);
        }
      }
    }
    
    if (jsonText) {
      const aiData = JSON.parse(jsonText);
      return {
        description: aiData.description || '',
        cameraMovements: aiData.cameraMovements || [],
        visualEffects: aiData.visualEffects || [],
        textOverlays: aiData.textOverlays || [],
        duration: aiData.duration || 10,
        marketingAngle: aiData.marketingAngle || ''
      };
    }
    
    return null;
  } catch (error) {
    console.warn('[Video Planning] Could not parse AI analysis JSON:', error);
    return null;
  }
}

async function ensureSceneMatchesPrompt(
  imageUrl: string, 
  aiPlan: AiVideoPlan | null, 
  originalPrompt: string,
  apiKey?: string
): Promise<{ enhancedImageUrl: string; enhancementsApplied: string[] }> {
  console.log('[Scene Enhancement] Checking if scene enhancement is needed...');
  
  // Check if office background is needed (multiple sources)
  const needsOffice = checkNeedsOfficeBackground(aiPlan, originalPrompt);
  if (!needsOffice) {
    console.log('[Scene Enhancement] No office background requested');
    return { enhancedImageUrl: imageUrl, enhancementsApplied: [] };
  }
  
  try {
    console.log('[Scene Enhancement] Generating office background scene...');
    
    // Extract office-specific requirements from visual effects
    let officeElements = '';
    if (aiPlan && aiPlan.visualEffects) {
      officeElements = aiPlan.visualEffects
        .filter(effect => effect.toLowerCase().includes('office') || 
                         effect.toLowerCase().includes('desk') ||
                         effect.toLowerCase().includes('workspace'))
        .join('. ');
    }
    
    // Create focused prompt for office background generation
    const scenePrompt = `Place this product in a clean, modern office environment. ${officeElements ? `Requirements: ${officeElements}.` : ''}
    
Specific elements to add:
- Clean, modern office desk or workspace surface
- Professional office lighting (natural light from windows preferred)
- Minimalist office background with neutral colors
- Optional: Subtle office elements like a laptop, papers, or office supplies in the background
- Maintain focus on the product while creating realistic office context

Keep the product exactly as shown but place it naturally in an office setting.`;

    // Force use of generation-capable model (ignore original analysis model)
    const generationModel = 'google/gemini-2.5-flash-image-preview';
    console.log('[Scene Enhancement] Using forced generation model:', generationModel);
    
    // Use existing AI image generation with generation-capable model
    const result = await processImageWithOpenRouter(imageUrl, scenePrompt, generationModel, apiKey, 120);
    
    console.log('[Scene Enhancement] Office background generated successfully');
    return {
      enhancedImageUrl: result.processedImageUrl,
      enhancementsApplied: ['AI scene enhancement', 'Office background generation', ...result.enhancementsApplied]
    };
    
  } catch (error) {
    console.warn('[Scene Enhancement] Failed to generate office background, using original image:', error);
    
    // Graceful fallback - return original image
    return { 
      enhancedImageUrl: imageUrl, 
      enhancementsApplied: ['Scene enhancement attempted (fallback to original)'] 
    };
  }
}

// Frame-based Ken Burns video generation using Sharp + FFmpeg
async function generateVideoFromImage(
  imageUrl: string, 
  analysis: string, 
  outputPath: string
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const frameDir = path.join(process.cwd(), 'temp_videos', `frames_${Date.now()}`);
    let tempImagePath: string | null = null;
    
    try {
      console.log('[Video Generation] Creating dynamic MP4 from image:', imageUrl);
      
      // Download image locally first
      console.log('[Video Generation] Downloading image locally...');
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      
      const imageBuffer = await response.arrayBuffer();
      tempImagePath = path.join(process.cwd(), 'temp_videos', `temp_image_${Date.now()}.png`);
      await fs.promises.writeFile(tempImagePath, Buffer.from(imageBuffer));
      
      console.log('[Video Generation] Image downloaded to:', tempImagePath);
      
      // Create frames directory
      await fs.promises.mkdir(frameDir, { recursive: true });
      
      // Generate frames with simple zoom effect using Sharp
      console.log('[Video Generation] Generating motion frames...');
      const frameCount = 300; // 10 seconds at 30 FPS
      const targetWidth = 1280;
      const targetHeight = 720;
      
      // Get source image dimensions
      const metadata = await sharp(tempImagePath).metadata();
      const sourceWidth = metadata.width || 1280;
      const sourceHeight = metadata.height || 720;
      
      console.log('[Video Generation] Source image dimensions:', sourceWidth, 'x', sourceHeight);
      
      // Parse AI analysis to determine motion type
      console.log('[Video Generation] Parsing AI analysis for motion effects...');
      let motionType = 'zoom'; // default fallback
      let rotationAmount = 360; // default for 360 rotation
      
      try {
        // Extract JSON from AI analysis  
        const jsonMatch = analysis.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          const aiData = JSON.parse(jsonMatch[1]);
          const movements = aiData.cameraMovements || [];
          const movementText = movements.join(' ').toLowerCase();
          
          console.log('[Video Generation] AI suggested movements:', movements);
          
          // Determine motion based on AI analysis
          if (movementText.includes('360') || movementText.includes('rotation')) {
            motionType = 'rotation360';
            console.log('[Video Generation] Implementing 360-degree rotation as suggested by AI');
          } else if (movementText.includes('fly') || movementText.includes('circle')) {
            motionType = 'flythrough';
            console.log('[Video Generation] Implementing fly-through effect as suggested by AI');
          } else if (movementText.includes('zoom') || movementText.includes('pan')) {
            motionType = 'zoom';
            console.log('[Video Generation] Implementing zoom effect as suggested by AI');
          }
        }
      } catch (parseError) {
        console.warn('[Video Generation] Could not parse AI analysis, using default zoom effect');
      }
      
      // Create frames based on AI analysis
      for (let frame = 0; frame < frameCount; frame++) {
        const progress = frame / (frameCount - 1); // 0 to 1
        
        let scale = 1.0;
        let rotation = 0;
        
        // Implement motion based on AI suggestions
        if (motionType === 'rotation360') {
          // Full 360-degree rotation as requested
          scale = 1.1 + (Math.sin(progress * Math.PI * 2) * 0.1); // Gentle zoom variation
          rotation = progress * 360; // Full 360-degree rotation
        } else if (motionType === 'flythrough') {
          // Circular fly-through effect
          scale = 1.3 - (progress * 0.3); // Zoom out
          rotation = progress * 180; // 180-degree rotation for fly-through
        } else {
          // Default zoom effect
          scale = 1.5 - (progress * 0.5); // Zoom out from 1.5x to 1.0x
          rotation = progress * 15; // Gentle rotation
        }
        
        // Calculate scaled dimensions
        const scaledWidth = Math.round(targetWidth * scale);
        const scaledHeight = Math.round(targetHeight * scale);
        
        // Generate frame with Sharp
        const framePath = path.join(frameDir, `frame_${frame.toString().padStart(4, '0')}.jpg`);
        
        if (frame % 50 === 0) {
          console.log(`[Video Generation] Frame ${frame}: ${motionType} scale=${scale.toFixed(3)} rotation=${rotation.toFixed(1)}° size=${scaledWidth}x${scaledHeight}`);
        }
        
        // Create motion effects based on AI analysis
        await sharp(tempImagePath)
          .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 }})
          .resize(scaledWidth, scaledHeight, { 
            fit: 'cover', 
            position: 'center' 
          })
          .resize(targetWidth, targetHeight, { 
            fit: 'contain',
            position: 'center',
            background: { r: 20, g: 20, b: 20 }
          })
          .jpeg({ quality: 90 })
          .toFile(framePath);
      }
      
      console.log('[Video Generation] Generated', frameCount, 'motion frames');
      
      // Assemble frames into video using FFmpeg (stable, no complex filters)
      console.log('[Video Generation] Assembling video from frames...');
      
      ffmpeg()
        .input(path.join(frameDir, 'frame_%04d.jpg'))
        .inputOptions([
          '-framerate 30'        // Input frame rate
        ])
        .videoCodec('libx264')
        .outputOptions([
          '-r 30',              // Output frame rate
          '-preset medium',     // Encoding quality
          '-crf 22',           // Quality (lower = better)
          '-pix_fmt yuv420p',  // Compatibility
          '-movflags +faststart' // Web optimization
        ])
        .output(outputPath)
        .on('start', (commandLine: string) => {
          console.log('[Video Generation] FFmpeg started:', commandLine);
        })
        .on('progress', (progress: any) => {
          console.log(`[Video Generation] Progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', async () => {
          console.log('[Video Generation] Ken Burns video created successfully');
          
          // Cleanup
          try {
            if (tempImagePath) await fs.promises.unlink(tempImagePath);
            await fs.promises.rm(frameDir, { recursive: true });
          } catch (cleanupError) {
            console.warn('[Video Generation] Failed to cleanup temp files:', cleanupError);
          }
          
          resolve();
        })
        .on('error', (err: Error) => {
          console.log('[Video Generation] Error during video assembly:', err);
          reject(err);
        })
        .run();
        
    } catch (error) {
      console.log('[Video Generation] Error:', error);
      
      // Cleanup on error
      try {
        if (tempImagePath) await fs.promises.unlink(tempImagePath);
        await fs.promises.rm(frameDir, { recursive: true });
      } catch (cleanupError) {
        console.warn('[Video Generation] Failed to cleanup after error:', cleanupError);
      }
      
      reject(error);
    }
  });
}

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

// Process multiple images with failover sequence
async function processMultipleImagesWithFailover(
  imageUrls: string[],
  prompt: string,
  modelConfig: any,
  timeoutSeconds: number = 120
): Promise<{ processedImageUrl: string; enhancementsApplied: string[]; processingTime: number; modelUsed: string }> {
  const startTime = Date.now();
  
  console.log(`[Multiple Images Failover] Starting processing with ${imageUrls.length} images`);
  
  // Get enabled models in priority order
  const modelPriorities = (modelConfig?.modelPriorities || [])
    .filter((item: any) => item.enabled)
    .sort((a: any, b: any) => a.priority - b.priority);
  
  // If no models configured in priorities, fallback to selectedModel
  if (modelPriorities.length === 0) {
    const fallbackModel = modelConfig?.selectedModel || 'google/gemini-2.5-flash-image';
    console.log(`[Multiple Images Failover] No model priorities configured, using fallback: ${fallbackModel}`);
    const result = await processMultipleImagesWithOpenRouter(imageUrls, prompt, fallbackModel, modelConfig?.apiKey, timeoutSeconds);
    return { ...result, modelUsed: fallbackModel };
  }
  
  console.log(`[Multiple Images Failover] Found ${modelPriorities.length} enabled models in sequence:`, modelPriorities.map((m: any) => `${m.priority}. ${m.model}`));
  
  let lastError: Error | null = null;
  
  // Try each model in priority order
  for (const modelItem of modelPriorities) {
    try {
      console.log(`[Multiple Images Failover] Attempting model: ${modelItem.model} (priority ${modelItem.priority})`);
      const result = await processMultipleImagesWithOpenRouter(imageUrls, prompt, modelItem.model, modelConfig?.apiKey, timeoutSeconds);
      console.log(`[Multiple Images Failover] Success with model: ${modelItem.model}`);
      return { ...result, modelUsed: modelItem.model };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[Multiple Images Failover] Model ${modelItem.model} failed: ${errorMessage}`);
      lastError = error instanceof Error ? error : new Error(errorMessage);
      
      // Continue to next model in sequence
      continue;
    }
  }
  
  // All models failed
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`[Multiple Images Failover] All ${modelPriorities.length} models failed after ${totalTime}s`);
  throw new Error(`All ${modelPriorities.length} configured models failed for multiple images processing. Last error: ${lastError?.message || 'Unknown error'}`);
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

// Process multiple images with OpenRouter for combination/composition
async function processMultipleImagesWithOpenRouter(
  imageUrls: string[],
  prompt: string,
  model: string,
  apiKey?: string,
  timeoutSeconds: number = 120
): Promise<{ processedImageUrl: string; enhancementsApplied: string[]; processingTime: number }> {
  const startTime = Date.now();
  
  console.log(`[Multiple Images Processing] Model: ${model}, Images: ${imageUrls.length}, Prompt: "${prompt}", Timeout: ${timeoutSeconds}s`);
  
  try {
    const keyToUse = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
    
    if (!keyToUse) {
      throw new Error('OpenRouter API key not configured');
    }

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    const baseUrl = domain ? `https://${domain}` : 'http://localhost:5000';
    
    // Convert all image URLs to full URLs
    const fullImageUrls = imageUrls.map(url => 
      url.startsWith('http') ? url : `${baseUrl}${url}`
    );
    
    console.log('[Multiple Images Processing] Image URLs:', fullImageUrls);
    
    // Check if this is Gemini 2.5 Flash Image (image generation model)
    if (model.includes('google/gemini-2.5-flash-image-preview')) {
      console.log('[Multiple Images Processing] Using Gemini 2.5 Flash for image combination');
      
      // Create a comprehensive prompt for combining multiple images
      const combinationPrompt = `COMBINE AND COMPOSE: You have ${imageUrls.length} source images that need to be combined into one cohesive image.

Your task: ${prompt}

Rules you MUST follow:
1. Analyze all ${imageUrls.length} provided images carefully
2. Create a single, cohesive composition that incorporates elements from all images
3. Maintain the visual quality and style consistency across the composition
4. Ensure proper lighting, shadows, and perspective throughout the combined image
5. Make the combination look natural and professionally composed
6. Pay attention to scale, proportion, and visual balance
7. Create smooth transitions between elements from different source images

This is image combination/composition work. Create one unified image from the multiple sources provided.`;
      
      console.log('[Debug] Combination prompt:', combinationPrompt);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutSeconds * 1000);

      // Prepare image content for the API - send all images
      const imageContent = fullImageUrls.map(url => ({
        type: 'image_url',
        image_url: { url }
      }));

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': baseUrl,
          'X-Title': 'AI Image Editor - Multiple Images'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: combinationPrompt
                },
                ...imageContent
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Multiple images generation failed: ${response.statusText} - ${errorBody}`);
      }

      const result = await response.json();
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      
      // Extract any image URLs from the response
      const content = result.choices?.[0]?.message?.content || '';
      const imageUrlMatch = content.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)|https?:\/\/[^\s]+\.(jpg|jpeg|png|webp)/gi);
      
      if (imageUrlMatch && imageUrlMatch.length > 0) {
        // Extract the first valid image URL
        let generatedImageUrl = imageUrlMatch[0];
        if (generatedImageUrl.startsWith('![')) {
          const urlMatch = generatedImageUrl.match(/\((https?:\/\/[^\)]+)\)/);
          if (urlMatch) {
            generatedImageUrl = urlMatch[1];
          }
        }
        
        console.log('[Multiple Images Processing] Generated image URL extracted:', generatedImageUrl);
        
        // Save the generated image to our S3 storage
        try {
          const imageResponse = await fetch(generatedImageUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const fileName = `combined-${Date.now()}.png`;
            
            console.log('[Multiple Images Processing] Saving combined image to S3...');
            const savedImagePath = await objectStorageService.uploadToS3(
              Buffer.from(imageBuffer),
              fileName,
              'image/png'
            );
            
            // Set ACL for public access
            if (savedImagePath.startsWith('/objects/')) {
              await objectStorageService.trySetObjectEntityAclPolicy(savedImagePath, {
                owner: 'system',
                visibility: 'public'
              });
            }
            
            console.log('[Multiple Images Processing] Combined image saved successfully:', savedImagePath);
            
            return {
              processedImageUrl: savedImagePath,
              enhancementsApplied: [`Combined ${imageUrls.length} images using ${model}`],
              processingTime
            };
          }
        } catch (saveError) {
          console.error('[Multiple Images Processing] Failed to save generated image:', saveError);
          // Fall back to returning the external URL
        }
        
        return {
          processedImageUrl: generatedImageUrl,
          enhancementsApplied: [`Combined ${imageUrls.length} images using ${model}`],
          processingTime
        };
      } else {
        throw new Error('No image generated in response from AI model');
      }
    } else {
      // For non-generation models, use vision analysis approach
      console.log('[Multiple Images Processing] Using vision model for analysis of multiple images');
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutSeconds * 1000);

      // Prepare image content for analysis
      const imageContent = fullImageUrls.map(url => ({
        type: 'image_url',
        image_url: { url }
      }));

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': baseUrl,
          'X-Title': 'AI Image Editor - Multiple Images Analysis'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze these ${imageUrls.length} images and provide detailed insights: ${prompt}`
                },
                ...imageContent
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.3
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Multiple images analysis failed: ${response.statusText} - ${errorBody}`);
      }

      const result = await response.json();
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      const analysis = result.choices?.[0]?.message?.content || 'No analysis provided';
      
      return {
        processedImageUrl: fullImageUrls[0], // Return first image as primary
        enhancementsApplied: [`Multi-image analysis (${imageUrls.length} images): ${analysis}`],
        processingTime
      };
    }
    
  } catch (error) {
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    console.error('[Multiple Images Processing] Error:', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Multiple images request timed out after ${timeoutSeconds} seconds`);
    }
    
    throw new Error(`Failed to process multiple images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Process video with OpenRouter (generates video from image)
async function processVideoWithOpenRouter(
  imageUrl: string, 
  prompt: string, 
  model: string,
  apiKey?: string,
  timeoutSeconds: number = 120,
  videoMode: 'real' | 'enhanced' | 'simple' = 'real'
): Promise<{ processedVideoUrl: string; enhancementsApplied: string[]; videoDuration: number; processingTime: number; providerUsed?: string; modelUsed?: string }> {
  const startTime = Date.now();
  
  console.log(`[Video Processing] Model: ${model}, Prompt: "${prompt}", Timeout: ${timeoutSeconds}s`);
  
  try {
    const keyToUse = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
    
    if (!keyToUse) {
      throw new Error('OpenRouter API key not configured');
    }

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    const baseUrl = domain ? `https://${domain}` : 'http://localhost:5000';
    const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;
    
    console.log('[Video Processing] Using AI to analyze image for video generation');
    console.log('[Debug] Image URL being sent:', fullImageUrl);
    
    // Create a video-specific prompt for AI analysis
    const videoPrompt = `ANALYZE this product image for video generation. 

Your task: ${prompt}

Based on this image, create a detailed video concept that includes:
1. Product description and key features to highlight
2. Suggested camera movements (zoom, pan, rotate)
3. Visual effects that would enhance the product presentation
4. Text overlays or callouts for key features
5. Duration and pacing recommendations

Focus on creating an engaging product showcase video that would be suitable for marketing or e-commerce purposes.

Provide a JSON response with this structure:
{
  "description": "detailed description of the product",
  "cameraMovements": ["movement1", "movement2"],
  "visualEffects": ["effect1", "effect2"],
  "textOverlays": ["text1", "text2"],
  "duration": 10,
  "marketingAngle": "primary selling point"
}`;
    
    console.log('[Debug] Video analysis prompt:', videoPrompt);

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
        'X-Title': 'AI Video Generator'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: videoPrompt
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
        temperature: 0.7,
        max_tokens: 1000,
        modalities: ["image", "text"]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Video Processing] OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[Video Processing] OpenRouter API response received');

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter API');
    }

    const aiAnalysis = data.choices[0].message.content;
    console.log('[Video Processing] AI Analysis:', aiAnalysis);

    // Parse AI analysis for scene enhancement (flexible parsing)
    const aiPlan = parseAiVideoPlanFlexible(aiAnalysis);
    console.log('[Video Processing] Parsed AI plan:', aiPlan ? 'Success' : 'Failed to parse');
    
    // Enhance scene if office background is needed
    const sceneResult = await ensureSceneMatchesPrompt(fullImageUrl, aiPlan, prompt, keyToUse);
    
    // Ensure enhanced URL is absolute (reuse existing baseUrl)
    const finalImageUrl = sceneResult.enhancedImageUrl.startsWith('http') 
      ? sceneResult.enhancedImageUrl 
      : `${baseUrl}${sceneResult.enhancedImageUrl}`;
    const sceneEnhancements = sceneResult.enhancementsApplied;
    
    if (sceneEnhancements.length > 0) {
      console.log('[Video Processing] Scene enhanced with:', sceneEnhancements);
    }

    console.log('[Video Processing] Starting video generation with provider system...');
    
    // Use new provider system for video generation
    const videoManager = new VideoProviderManager();
    const duration = aiPlan?.duration || 10;
    
    const videoResult = await videoManager.generateVideo({
      imageUrl: finalImageUrl,
      prompt: aiAnalysis,
      duration,
      model,
      apiKey: keyToUse,
      preferredMode: videoMode
    });
    
    console.log('[Video Processing] Video generation completed with provider:', videoResult.providerUsed);
    
    return {
      processedVideoUrl: videoResult.videoUrl,
      enhancementsApplied: [
        "AI-powered video analysis",
        ...sceneEnhancements,
        ...videoResult.enhancementsApplied
      ],
      videoDuration: duration,
      processingTime: videoResult.processingTime,
      providerUsed: videoResult.providerUsed,
      modelUsed: videoResult.modelUsed
    };
    
  } catch (error) {
    console.error('[Video Processing] Error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Video processing timed out after ${timeoutSeconds} seconds`);
    }
    
    throw new Error(`Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Note: Videos are now served through /objects/ route after being uploaded to S3


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

      // Get admin model configuration (API key is admin-controlled for all users)
      const adminUser = await storage.getUserByRole('admin');
      const adminUserId = adminUser?.id;
      
      if (!adminUserId) {
        return res.status(500).json({ message: "Admin user not found" });
      }
      
      const adminConfig = await storage.getModelConfiguration(adminUserId);
      console.log('[Processing] Admin config retrieved for all users:', adminConfig ? 'YES' : 'NO');
      
      if (!adminConfig || !adminConfig.apiKey) {
        return res.status(500).json({ 
          message: "OpenRouter API key not configured by admin. Please contact administrator." 
        });
      }
      
      // Use admin's configuration for API access, but allow fallback model selection
      const selectedModel = adminConfig.selectedModel || 'google/gemini-2.5-flash-image';
      const modelConfig = adminConfig; // Use admin config for all processing

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

  // Process multiple images with AI for combination/composition
  app.post("/api/process-multiple-images", isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId, imageUrls, prompt } = req.body;
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      console.log('[Multiple Images Processing] Request from user:', userId);
      
      if (!conversationId || !prompt || !imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({ 
          message: "Missing required fields: conversationId, imageUrls (array), prompt" 
        });
      }

      if (imageUrls.length > 10) {
        return res.status(400).json({ 
          message: "Maximum 10 images allowed for combination processing" 
        });
      }

      // Get admin model configuration (API key is admin-controlled for all users)
      const adminUser = await storage.getUserByRole('admin');
      const adminUserId = adminUser?.id;
      
      if (!adminUserId) {
        return res.status(500).json({ message: "Admin user not found" });
      }
      
      const adminConfig = await storage.getModelConfiguration(adminUserId);
      console.log('[Multiple Images Processing] Admin config retrieved:', adminConfig ? 'YES' : 'NO');
      
      if (!adminConfig || !adminConfig.apiKey) {
        return res.status(500).json({ 
          message: "OpenRouter API key not configured by admin. Please contact administrator." 
        });
      }
      
      // Use admin's configuration for API access
      const selectedModel = adminConfig.selectedModel || 'google/gemini-2.5-flash-image';
      const modelConfig = adminConfig;

      // Create user message with multiple images (store as JSON in enhancementsApplied)
      const userMessage = await storage.createMessage({
        conversationId,
        role: 'user',
        content: `${prompt} [${imageUrls.length} images uploaded]`,
        imageUrl: imageUrls[0], // Store first image URL for display
        processingStatus: 'completed'
      });

      // Create AI message placeholder
      const aiMessage = await storage.createMessage({
        conversationId,
        role: 'assistant',
        content: `Processing ${imageUrls.length} images for combination...`,
        processingStatus: 'processing'
      });

      // Create processing job (store multiple image URLs in enhancementsApplied)
      const processingJob = await storage.createImageProcessingJob({
        messageId: aiMessage.id,
        originalImageUrl: imageUrls[0], // Primary image for compatibility
        prompt,
        model: selectedModel,
        status: 'processing',
        enhancementsApplied: imageUrls // Store all image URLs here
      });
      
      console.log('[Multiple Images Processing] Created job:', processingJob.id);

      res.json({ 
        userMessage, 
        aiMessage, 
        processingJob 
      });

      // Process multiple images asynchronously
      setImmediate(async () => {
        try {
          console.log('[Multiple Images Processing] Starting async processing for job:', processingJob.id);
          
          // Get timeout configuration
          const timeoutSeconds = modelConfig?.timeout || 120;
          const result = await processMultipleImagesWithFailover(imageUrls, prompt, modelConfig, timeoutSeconds);
          
          console.log('[Multiple Images Processing] Failover completed, updating job:', processingJob.id);
          
          // Update processing job
          await storage.updateImageProcessingJob(processingJob.id, {
            status: 'completed',
            processedImageUrl: result.processedImageUrl,
            processingTime: result.processingTime,
            enhancementsApplied: [...imageUrls, ...result.enhancementsApplied],
            model: result.modelUsed
          });

          console.log('[Multiple Images Processing] Job updated successfully:', processingJob.id);

          // Update AI message
          await storage.updateMessage(aiMessage.id, {
            content: `✨ Images combined successfully using ${imageUrls.length} source images`,
            imageUrl: result.processedImageUrl,
            processingStatus: 'completed'
          });

          console.log('[Multiple Images Processing] Message updated successfully for job:', processingJob.id);

        } catch (error) {
          console.error('[Multiple Images Processing] Error during async processing:', error);
          
          try {
            // Update processing job with error
            await storage.updateImageProcessingJob(processingJob.id, {
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });

            // Update AI message with error
            await storage.updateMessage(aiMessage.id, {
              content: `Sorry, I encountered an error while processing your ${imageUrls.length} images: ${error instanceof Error ? error.message : 'Unknown error'}`,
              processingStatus: 'error'
            });
            
            console.log('[Multiple Images Processing] Error status updated for job:', processingJob.id);
          } catch (updateError) {
            console.error('[Multiple Images Processing] Failed to update error status:', updateError);
          }
        }
      });

    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process multiple images" 
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

  // Process image to video with AI
  app.post("/api/process-video", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body with Zod
      const videoRequestSchema = insertVideoProcessingJobSchema
        .pick({ prompt: true })
        .extend({
          conversationId: z.string(),
          imageUrl: z.string().optional()
        });
      
      const validatedData = videoRequestSchema.parse(req.body);
      const { conversationId, imageUrl, prompt } = validatedData;
      
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      console.log('[Video Processing] Request from user:', userId);

      // Verify conversation ownership for security
      const conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(403).json({ 
          message: "Unauthorized: You don't have access to this conversation" 
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

      // Get user's model configuration with fallback to global default
      let modelConfig = await storage.getModelConfiguration(userId);
      
      if (!modelConfig) {
        // Fallback to global default configuration
        modelConfig = await storage.getGlobalDefaultConfiguration();
      }
      
      if (!modelConfig) {
        // Final fallback to admin configuration if no global default exists
        const adminUser = await storage.getUserByRole('admin');
        if (adminUser?.id) {
          modelConfig = await storage.getModelConfiguration(adminUser.id);
        }
      }
      
      console.log('[Video Processing] Model config retrieved for user:', userId, 'Has config:', modelConfig ? 'YES' : 'NO');
      
      if (!modelConfig || !modelConfig.apiKey) {
        return res.status(500).json({ 
          message: "OpenRouter API key not configured. Please contact administrator." 
        });
      }
      
      // Use resolved configuration for API access
      // For video processing, use a model that supports image analysis
      let selectedModel = modelConfig.selectedModel || 'google/gemini-2.5-flash-image';
      
      // Fix model name for video processing - remove :free suffix which may not be valid
      if (selectedModel.includes(':free')) {
        selectedModel = selectedModel.replace(':free', '');
      }
      
      // Ensure we use a model that supports vision tasks
      if (!selectedModel.includes('gemini-2.5-flash')) {
        selectedModel = 'google/gemini-2.5-flash-image-preview';
      }

      // Create user message (include the final image URL for traceability)
      const userMessage = await storage.createMessage({
        conversationId,
        role: 'user',
        content: prompt,
        imageUrl: finalImageUrl, // Use finalImageUrl for consistency and traceability
        mediaType: 'image',
        processingStatus: 'completed'
      });

      // Create AI message placeholder
      const aiMessage = await storage.createMessage({
        conversationId,
        role: 'assistant',
        content: 'Processing your image into video...',
        mediaType: 'video',
        processingStatus: 'processing'
      });

      // Create video processing job
      const processingJob = await storage.createVideoProcessingJob({
        messageId: aiMessage.id,
        originalImageUrl: finalImageUrl,
        prompt,
        model: selectedModel,
        status: 'processing'
      });
      
      console.log('[Video Processing] Created job:', processingJob.id);

      res.json({ 
        userMessage, 
        aiMessage, 
        processingJob 
      });

      // Process video asynchronously with real video generation
      setImmediate(async () => {
        try {
          console.log('[Video Processing] Starting async processing for job:', processingJob.id);
          
          const startTime = Date.now();
          
          // Call video generation API
          const result = await processVideoWithOpenRouter(
            finalImageUrl,
            prompt,
            selectedModel,
            modelConfig.apiKey || undefined,
            modelConfig.timeout || 120
          );
          
          const processingTime = Math.round((Date.now() - startTime) / 1000);
          
          // Update processing job
          await storage.updateVideoProcessingJob(processingJob.id, {
            status: 'completed',
            processedVideoUrl: result.processedVideoUrl,
            processingTime,
            enhancementsApplied: result.enhancementsApplied,
            videoDuration: result.videoDuration || 10
          });

          console.log('[Video Processing] Job updated successfully:', processingJob.id);

          // Update AI message
          await storage.updateMessage(aiMessage.id, {
            content: `✨ Video generated successfully from your image`,
            videoUrl: result.processedVideoUrl,
            processingStatus: 'completed'
          });

          console.log('[Video Processing] Message updated successfully for job:', processingJob.id);

        } catch (error) {
          console.error('[Video Processing] Error during async processing:', error);
          
          try {
            // Update processing job with error
            await storage.updateVideoProcessingJob(processingJob.id, {
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });

            // Update AI message with error
            await storage.updateMessage(aiMessage.id, {
              content: `Sorry, I encountered an error while generating your video: ${error instanceof Error ? error.message : 'Unknown error'}`,
              processingStatus: 'error'
            });
            
            console.log('[Video Processing] Error status updated for job:', processingJob.id);
          } catch (updateError) {
            console.error('[Video Processing] Failed to update error status:', updateError);
          }
        }
      });

    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process video" 
      });
    }
  });

  // Get video processing job status
  app.get("/api/video-processing-jobs/:messageId", async (req, res) => {
    try {
      const { messageId } = req.params;
      const job = await storage.getVideoProcessingJobByMessage(messageId);
      
      if (!job) {
        return res.status(404).json({ message: "Video processing job not found" });
      }

      res.json(job);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch video processing job" 
      });
    }
  });

  // Get model configuration (admin only)
  app.get("/api/model-config", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
      console.log('[Config] Loading for user:', userId);
      
      const config = await storage.getModelConfiguration(userId);
      console.log('[Config] Loaded from database:', config ? { ...config, apiKey: config.apiKey ? '***HIDDEN***' : 'none' } : 'none');
      
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

  // Get authenticated user's saved images
  app.get("/api/library", isAuthenticated, async (req: any, res) => {
    try {
      // Get user ID from authenticated session  
      const userId = req.user?.claims?.sub || req.user?.id || 'default';
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
      const parseResult = insertPromptTemplateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid prompt template data", errors: parseResult.error.errors });
      }

      const templateData = { ...parseResult.data, createdBy: req.user.id };
      const template = await storage.createPromptTemplate(templateData);
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
      
      // For updates, we'll use a partial validation (allow omitting some fields)
      const updateSchema = insertPromptTemplateSchema.partial();
      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid prompt template update data", errors: parseResult.error.errors });
      }
      
      const template = await storage.updatePromptTemplate(id, parseResult.data);
      
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

  // ==================== APPLICATION FUNCTION ROUTES ====================

  // Get enabled application functions (accessible to all authenticated users)
  app.get("/api/application-functions", isAuthenticated, async (req: any, res) => {
    try {
      const functions = await storage.getEnabledApplicationFunctions();
      res.json(functions);
    } catch (error) {
      console.error('Error fetching application functions:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch application functions" 
      });
    }
  });

  // Get all application functions for admin (including disabled ones)
  app.get("/api/admin/application-functions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const functions = await storage.getApplicationFunctions();
      res.json(functions);
    } catch (error) {
      console.error('Error fetching all application functions:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch application functions" 
      });
    }
  });

  // Create application function (admin only)
  app.post("/api/admin/application-functions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parseResult = insertApplicationFunctionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid application function data", errors: parseResult.error.errors });
      }

      const functionData = { ...parseResult.data, createdBy: req.user.id };
      const func = await storage.createApplicationFunction(functionData);
      res.json(func);
    } catch (error) {
      console.error('Error creating application function:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create application function" 
      });
    }
  });

  // Update application function (admin only)
  app.put("/api/admin/application-functions/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // For updates, we'll use a partial validation (allow omitting some fields)
      const updateSchema = insertApplicationFunctionSchema.partial();
      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid application function update data", errors: parseResult.error.errors });
      }
      
      const func = await storage.updateApplicationFunction(id, parseResult.data);
      
      if (!func) {
        return res.status(404).json({ message: "Application function not found" });
      }
      
      res.json(func);
    } catch (error) {
      console.error('Error updating application function:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to update application function" 
      });
    }
  });

  // Delete application function (admin only)
  app.delete("/api/admin/application-functions/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteApplicationFunction(id);
      
      if (!success) {
        return res.status(404).json({ message: "Application function not found" });
      }
      
      res.json({ message: "Application function deleted successfully" });
    } catch (error) {
      console.error('Error deleting application function:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete application function" 
      });
    }
  });

  // Get prompt templates by function (admin only)
  app.get("/api/admin/application-functions/:id/templates", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const templates = await storage.getPromptTemplatesByFunction(id);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates by function:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch templates" 
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

      // Get the admin model configuration (enhancement is an admin function)
      const adminUser = await storage.getUserByRole('admin');
      if (!adminUser) {
        return res.status(500).json({ message: "Admin user not found" });
      }
      
      const config = await storage.getModelConfiguration(adminUser.id);
      
      if (!config || !config.apiKey) {
        return res.status(400).json({ message: "OpenRouter API key not configured" });
      }

      // Call OpenRouter API to enhance the template using configured enhancement model
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
          model: config.enhancementModel || 'openai/gpt-4o-mini',
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

  // Logout route
  app.get("/api/logout", (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      // Destroy session completely
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
        // Clear session cookie
        res.clearCookie('connect.sid');
        // Redirect to home page
        res.redirect('/');
      });
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
