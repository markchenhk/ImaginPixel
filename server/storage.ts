import { 
  type Conversation, 
  type InsertConversation,
  type Message,
  type InsertMessage,
  type ImageProcessingJob,
  type InsertImageProcessingJob,
  type ModelConfiguration,
  type InsertModelConfiguration,
  type ConversationWithMessages,
  type MessageWithJob,
  conversations,
  messages,
  imageProcessingJobs,
  modelConfigurations
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

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

  // User Context Functions - 用户上下文功能
  getConversationWithMessages(conversationId: string): Promise<ConversationWithMessages | undefined>;
  getRecentConversationsWithMessages(limit?: number): Promise<ConversationWithMessages[]>;
  getUserConversationHistory(userId?: string): Promise<ConversationWithMessages[]>;
  getLatestImageFromConversation(conversationId: string): Promise<string | undefined>;
}


export class DatabaseStorage implements IStorage {
  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return await db.select().from(conversations).orderBy(desc(conversations.createdAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values(insertConversation)
      .returning();
    return conversation;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await db.delete(conversations).where(eq(conversations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Messages
  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set(updates)
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  // Image Processing Jobs
  async getImageProcessingJob(id: string): Promise<ImageProcessingJob | undefined> {
    const [job] = await db.select().from(imageProcessingJobs).where(eq(imageProcessingJobs.id, id));
    return job;
  }

  async getImageProcessingJobByMessage(messageId: string): Promise<ImageProcessingJob | undefined> {
    const [job] = await db
      .select()
      .from(imageProcessingJobs)
      .where(eq(imageProcessingJobs.messageId, messageId));
    return job;
  }

  async createImageProcessingJob(insertJob: InsertImageProcessingJob): Promise<ImageProcessingJob> {
    const [job] = await db
      .insert(imageProcessingJobs)
      .values({
        messageId: insertJob.messageId,
        originalImageUrl: insertJob.originalImageUrl,
        prompt: insertJob.prompt,
        model: insertJob.model,
        status: insertJob.status || 'pending'
      })
      .returning();
    return job;
  }

  async updateImageProcessingJob(id: string, updates: Partial<ImageProcessingJob>): Promise<ImageProcessingJob | undefined> {
    const setData: any = { ...updates };
    if (updates.status === 'completed' || updates.status === 'error') {
      setData.completedAt = new Date();
    }
    
    const [job] = await db
      .update(imageProcessingJobs)
      .set(setData)
      .where(eq(imageProcessingJobs.id, id))
      .returning();
    return job;
  }

  // Model Configuration
  async getModelConfiguration(userId: string = "default"): Promise<ModelConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(modelConfigurations)
      .where(eq(modelConfigurations.userId, userId));
    return config;
  }

  async createOrUpdateModelConfiguration(insertConfig: InsertModelConfiguration): Promise<ModelConfiguration> {
    const userId = insertConfig.userId || "default";
    
    // Try to update existing configuration
    const [updatedConfig] = await db
      .insert(modelConfigurations)
      .values({
        ...insertConfig,
        userId,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: modelConfigurations.userId,
        set: {
          ...insertConfig,
          updatedAt: new Date()
        }
      })
      .returning();
    
    return updatedConfig;
  }

  // User Context Functions - 用户上下文功能
  async getConversationWithMessages(conversationId: string): Promise<ConversationWithMessages | undefined> {
    // Get conversation with all messages and their image processing jobs
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return undefined;

    const conversationMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: [messages.createdAt],
      with: {
        imageProcessingJobs: true,
      },
    });

    return {
      ...conversation,
      messages: conversationMessages as MessageWithJob[],
    };
  }

  async getRecentConversationsWithMessages(limit: number = 10): Promise<ConversationWithMessages[]> {
    // Get recent conversations with their messages for context
    const recentConversations = await db.query.conversations.findMany({
      orderBy: [desc(conversations.createdAt)],
      limit,
      with: {
        messages: {
          orderBy: [messages.createdAt],
          with: {
            imageProcessingJobs: true,
          },
        },
      },
    });

    return recentConversations as ConversationWithMessages[];
  }

  async getUserConversationHistory(userId: string = "default"): Promise<ConversationWithMessages[]> {
    // Get all conversations for a user with full context
    // For now, returning all conversations since we don't have user-specific conversations yet
    return this.getRecentConversationsWithMessages(50);
  }

  // Get the latest image URL from a conversation (either uploaded or generated)
  async getLatestImageFromConversation(conversationId: string): Promise<string | undefined> {
    const conversationMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: [desc(messages.createdAt)],
      with: {
        imageProcessingJobs: true,
      },
    });

    // Look for the most recent message with an image URL
    for (const message of conversationMessages) {
      // Check for processed image first (latest generated image)
      const latestJob = message.imageProcessingJobs?.[0];
      if (latestJob?.processedImageUrl) {
        return latestJob.processedImageUrl;
      }
      
      // Fall back to original message image
      if (message.imageUrl) {
        return message.imageUrl;
      }
    }

    return undefined;
  }
}

export const storage = new DatabaseStorage();
