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
  type SavedImage,
  type InsertSavedImage,
  type PromptTemplate,
  type InsertPromptTemplate,
  type ApplicationFunction,
  type InsertApplicationFunction,
  type User,
  type UpsertUser,
  conversations,
  messages,
  imageProcessingJobs,
  modelConfigurations,
  savedImages,
  promptTemplates,
  applicationFunctions,
  users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations for authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByRole(role: string): Promise<User | undefined>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Conversations
  getConversations(userId?: string): Promise<Conversation[]>;
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
  getGlobalDefaultConfiguration(): Promise<ModelConfiguration | undefined>;

  // User Context Functions - 用户上下文功能
  getConversationWithMessages(conversationId: string): Promise<ConversationWithMessages | undefined>;
  getRecentConversationsWithMessages(userId?: string, limit?: number): Promise<ConversationWithMessages[]>;
  getUserConversationHistory(userId: string): Promise<ConversationWithMessages[]>;
  getLatestImageFromConversation(conversationId: string): Promise<string | undefined>;

  // User Library Functions
  createSavedImage(savedImage: InsertSavedImage): Promise<SavedImage>;
  getSavedImage(id: string): Promise<SavedImage | undefined>;
  getUserSavedImages(userId: string, options?: { page?: number; limit?: number; tags?: string[] }): Promise<SavedImage[]>;
  deleteSavedImage(id: string, userId: string): Promise<boolean>;

  // Application Function Operations (Admin Only)
  getApplicationFunctions(): Promise<ApplicationFunction[]>;
  getEnabledApplicationFunctions(): Promise<ApplicationFunction[]>;
  getApplicationFunction(id: string): Promise<ApplicationFunction | undefined>;
  createApplicationFunction(func: InsertApplicationFunction): Promise<ApplicationFunction>;
  updateApplicationFunction(id: string, updates: Partial<ApplicationFunction>): Promise<ApplicationFunction | undefined>;
  deleteApplicationFunction(id: string): Promise<boolean>;

  // Prompt Template Functions (Admin Only)
  getPromptTemplates(): Promise<PromptTemplate[]>;
  getPromptTemplatesByFunction(functionId: string): Promise<PromptTemplate[]>;
  getPromptTemplate(id: string): Promise<PromptTemplate | undefined>;
  createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate>;
  updatePromptTemplate(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate | undefined>;
  deletePromptTemplate(id: string): Promise<boolean>;
  incrementTemplateUsage(id: string): Promise<void>;
}


export class DatabaseStorage implements IStorage {
  // User operations for authentication
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByRole(role: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.role, role));
    return user;
  }

  async createUser(userData: Omit<UpsertUser, 'id'>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Conversations
  async getConversations(userId?: string): Promise<Conversation[]> {
    if (userId) {
      return await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.createdAt));
    }
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
    
    try {
      // Properly structure the data for insertion
      const configData = {
        userId,
        selectedModel: insertConfig.selectedModel,
        outputQuality: insertConfig.outputQuality,
        maxResolution: insertConfig.maxResolution,
        timeout: insertConfig.timeout,
        apiKey: insertConfig.apiKey,
        apiKeyConfigured: insertConfig.apiKeyConfigured,
        // Ensure modelPriorities is properly typed as an array
        modelPriorities: (Array.isArray(insertConfig.modelPriorities) 
          ? insertConfig.modelPriorities 
          : []) as { model: string; priority: number; enabled: boolean; }[],
        updatedAt: new Date()
      };

      // Try to update existing configuration
      const [updatedConfig] = await db
        .insert(modelConfigurations)
        .values([configData])
        .onConflictDoUpdate({
          target: modelConfigurations.userId,
          set: {
            selectedModel: configData.selectedModel,
            outputQuality: configData.outputQuality,
            maxResolution: configData.maxResolution,
            timeout: configData.timeout,
            apiKey: configData.apiKey,
            apiKeyConfigured: configData.apiKeyConfigured,
            modelPriorities: configData.modelPriorities,
            updatedAt: new Date()
          }
        })
        .returning();
      
      return updatedConfig;
    } catch (error) {
      console.error('[Storage] Model config upsert failed:', error);
      throw error;
    }
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


  async getUserConversationHistory(userId: string): Promise<ConversationWithMessages[]> {
    // Get all conversations for a specific user with full context
    const userConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
      orderBy: [desc(conversations.createdAt)],
      with: {
        messages: {
          orderBy: [messages.createdAt],
          with: {
            imageProcessingJobs: true,
          },
        },
      },
    });

    return userConversations as ConversationWithMessages[];
  }

  async getRecentConversationsWithMessages(userId?: string, limit: number = 10): Promise<ConversationWithMessages[]> {
    // Get recent conversations with their messages for context
    let query = db.query.conversations.findMany({
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

    if (userId) {
      query = db.query.conversations.findMany({
        where: eq(conversations.userId, userId),
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
    }

    const recentConversations = await query;
    return recentConversations as ConversationWithMessages[];
  }

  async getGlobalDefaultConfiguration(): Promise<ModelConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(modelConfigurations)
      .where(eq(modelConfigurations.isGlobalDefault, "true"));
    return config;
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

  // User Library Functions
  async createSavedImage(insertSavedImage: InsertSavedImage): Promise<SavedImage> {
    const [savedImage] = await db
      .insert(savedImages)
      .values(insertSavedImage)
      .returning();
    return savedImage;
  }

  async getSavedImage(id: string): Promise<SavedImage | undefined> {
    const [savedImage] = await db.select().from(savedImages).where(eq(savedImages.id, id));
    return savedImage;
  }

  async getUserSavedImages(
    userId: string, 
    options: { page?: number; limit?: number; tags?: string[] } = {}
  ): Promise<SavedImage[]> {
    const { page = 1, limit = 20, tags } = options;
    const offset = (page - 1) * limit;

    let whereConditions = [eq(savedImages.userId, userId)];

    // Filter by tags if provided
    if (tags && tags.length > 0) {
      // Use SQL to check if any of the provided tags exist in the tags array
      whereConditions.push(
        sql`${savedImages.tags} && ${tags}`
      );
    }

    const query = db.select().from(savedImages).where(and(...whereConditions));

    const results = await query
      .orderBy(desc(savedImages.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  async deleteSavedImage(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(savedImages)
      .where(
        and(
          eq(savedImages.id, id),
          eq(savedImages.userId, userId)
        )
      );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Application Function Operations (Admin Only)
  async getApplicationFunctions(): Promise<ApplicationFunction[]> {
    return await db.select().from(applicationFunctions).orderBy(sql`${applicationFunctions.sortOrder} ASC`);
  }

  async getEnabledApplicationFunctions(): Promise<ApplicationFunction[]> {
    return await db.select().from(applicationFunctions).where(
      sql`${applicationFunctions.enabled} = 'true' OR ${applicationFunctions.enabled} = 't'`
    ).orderBy(sql`${applicationFunctions.sortOrder} ASC`);
  }

  async getApplicationFunction(id: string): Promise<ApplicationFunction | undefined> {
    const [func] = await db.select().from(applicationFunctions).where(eq(applicationFunctions.id, id));
    return func;
  }

  async createApplicationFunction(func: InsertApplicationFunction): Promise<ApplicationFunction> {
    const [newFunction] = await db
      .insert(applicationFunctions)
      .values(func)
      .returning();
    return newFunction;
  }

  async updateApplicationFunction(id: string, updates: Partial<ApplicationFunction>): Promise<ApplicationFunction | undefined> {
    const [updatedFunction] = await db
      .update(applicationFunctions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applicationFunctions.id, id))
      .returning();
    return updatedFunction;
  }

  async deleteApplicationFunction(id: string): Promise<boolean> {
    const result = await db
      .delete(applicationFunctions)
      .where(eq(applicationFunctions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Prompt Template Functions (Admin Only)
  async getPromptTemplates(): Promise<PromptTemplate[]> {
    return await db.select().from(promptTemplates).orderBy(desc(promptTemplates.updatedAt));
  }

  async getPromptTemplatesByFunction(functionId: string): Promise<PromptTemplate[]> {
    return await db.select().from(promptTemplates).where(eq(promptTemplates.functionId, functionId)).orderBy(desc(promptTemplates.updatedAt));
  }

  async getEnabledPromptTemplates(): Promise<PromptTemplate[]> {
    // Handle both text "true" and boolean true values for compatibility
    return await db.select().from(promptTemplates).where(
      sql`${promptTemplates.enabled} = 'true' OR ${promptTemplates.enabled} = 't' OR ${promptTemplates.enabled} = true`
    ).orderBy(desc(promptTemplates.updatedAt));
  }

  async getPromptTemplate(id: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, id));
    return template;
  }

  async createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate> {
    const [newTemplate] = await db
      .insert(promptTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updatePromptTemplate(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(promptTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(promptTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deletePromptTemplate(id: string): Promise<boolean> {
    const result = await db
      .delete(promptTemplates)
      .where(eq(promptTemplates.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db
      .update(promptTemplates)
      .set({
        usage: sql`${promptTemplates.usage} + 1`,
        updatedAt: new Date()
      })
      .where(eq(promptTemplates.id, id));
  }
}

export const storage = new DatabaseStorage();
