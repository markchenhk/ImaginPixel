import { 
  type Conversation, 
  type InsertConversation,
  type Message,
  type InsertMessage,
  type ImageProcessingJob,
  type InsertImageProcessingJob,
  type ModelConfiguration,
  type InsertModelConfiguration
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Conversations
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  deleteConversation(id: string): Promise<boolean>;

  // Messages
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;

  // Image Processing Jobs
  getImageProcessingJob(id: string): Promise<ImageProcessingJob | undefined>;
  getImageProcessingJobByMessage(messageId: string): Promise<ImageProcessingJob | undefined>;
  createImageProcessingJob(job: InsertImageProcessingJob): Promise<ImageProcessingJob>;
  updateImageProcessingJob(id: string, updates: Partial<ImageProcessingJob>): Promise<ImageProcessingJob | undefined>;

  // Model Configuration
  getModelConfiguration(userId?: string): Promise<ModelConfiguration | undefined>;
  createOrUpdateModelConfiguration(config: InsertModelConfiguration): Promise<ModelConfiguration>;
}

export class MemStorage implements IStorage {
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private imageProcessingJobs: Map<string, ImageProcessingJob>;
  private modelConfigurations: Map<string, ModelConfiguration>;

  constructor() {
    this.conversations = new Map();
    this.messages = new Map();
    this.imageProcessingJobs = new Map();
    this.modelConfigurations = new Map();
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async deleteConversation(id: string): Promise<boolean> {
    return this.conversations.delete(id);
  }

  // Messages
  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      createdAt: new Date(),
      imageUrl: insertMessage.imageUrl || null,
      processingStatus: insertMessage.processingStatus || null,
    };
    this.messages.set(id, message);
    return message;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, ...updates };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }

  // Image Processing Jobs
  async getImageProcessingJob(id: string): Promise<ImageProcessingJob | undefined> {
    return this.imageProcessingJobs.get(id);
  }

  async getImageProcessingJobByMessage(messageId: string): Promise<ImageProcessingJob | undefined> {
    return Array.from(this.imageProcessingJobs.values()).find(job => job.messageId === messageId);
  }

  async createImageProcessingJob(insertJob: InsertImageProcessingJob): Promise<ImageProcessingJob> {
    const id = randomUUID();
    const job: ImageProcessingJob = {
      ...insertJob,
      id,
      createdAt: new Date(),
      completedAt: null,
      processedImageUrl: null,
      processingTime: null,
      errorMessage: null,
      enhancementsApplied: null,
    };
    this.imageProcessingJobs.set(id, job);
    return job;
  }

  async updateImageProcessingJob(id: string, updates: Partial<ImageProcessingJob>): Promise<ImageProcessingJob | undefined> {
    const job = this.imageProcessingJobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    if (updates.status === 'completed' || updates.status === 'error') {
      updatedJob.completedAt = new Date();
    }
    this.imageProcessingJobs.set(id, updatedJob);
    return updatedJob;
  }

  // Model Configuration
  async getModelConfiguration(userId: string = "default"): Promise<ModelConfiguration | undefined> {
    return this.modelConfigurations.get(userId);
  }

  async createOrUpdateModelConfiguration(insertConfig: InsertModelConfiguration): Promise<ModelConfiguration> {
    const userId = insertConfig.userId || "default";
    const existing = this.modelConfigurations.get(userId);
    
    if (existing) {
      const updated: ModelConfiguration = {
        id: existing.id,
        userId: insertConfig.userId || existing.userId,
        selectedModel: insertConfig.selectedModel || existing.selectedModel,
        outputQuality: insertConfig.outputQuality || existing.outputQuality,
        maxResolution: insertConfig.maxResolution || existing.maxResolution,
        timeout: insertConfig.timeout || existing.timeout,
        apiKey: insertConfig.apiKey !== undefined ? insertConfig.apiKey : existing.apiKey,
        apiKeyConfigured: insertConfig.apiKeyConfigured || existing.apiKeyConfigured,
        updatedAt: new Date(),
      };
      this.modelConfigurations.set(userId, updated);
      return updated;
    } else {
      const id = randomUUID();
      const config: ModelConfiguration = {
        id,
        userId,
        selectedModel: insertConfig.selectedModel || 'openai/gpt-4o',
        outputQuality: insertConfig.outputQuality || 'high',
        maxResolution: insertConfig.maxResolution || 2048,
        timeout: insertConfig.timeout || 120,
        apiKey: insertConfig.apiKey || null,
        apiKeyConfigured: insertConfig.apiKeyConfigured || 'false',
        updatedAt: new Date(),
      };
      this.modelConfigurations.set(userId, config);
      return config;
    }
  }
}

export const storage = new MemStorage();
