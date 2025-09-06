import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User management table with role-based access and username/password auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  email: varchar("email").unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  processingStatus: text("processing_status").default("completed"), // 'processing' | 'completed' | 'error'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const imageProcessingJobs = pgTable("image_processing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id).notNull(),
  originalImageUrl: text("original_image_url").notNull(),
  processedImageUrl: text("processed_image_url"),
  prompt: text("prompt").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'error'
  processingTime: integer("processing_time"), // in seconds
  errorMessage: text("error_message"),
  enhancementsApplied: json("enhancements_applied").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const modelConfigurations = pgTable("model_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  selectedModel: text("selected_model").notNull().default("google/gemini-2.5-flash-image"),
  // Multiple models with priority ordering for failover
  modelPriorities: jsonb("model_priorities").$type<{
    model: string;
    priority: number;
    enabled: boolean;
  }[]>().default([]),
  outputQuality: text("output_quality").notNull().default("high"), // 'standard' | 'high' | 'ultra'
  maxResolution: integer("max_resolution").notNull().default(2048),
  timeout: integer("timeout").notNull().default(120), // seconds
  apiKey: text("api_key"), // OpenRouter API key storage
  openaiApiKey: text("openai_api_key"), // OpenAI API key for DALL-E 3
  apiKeyConfigured: text("api_key_configured").notNull().default("false"),
  isGlobalDefault: text("is_global_default").notNull().default("false"), // Admin can set global defaults
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User library for saved images
export const savedImages = pgTable("saved_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  objectPath: varchar("object_path").notNull(), // S3 object path
  originalImagePath: varchar("original_image_path"), // Path to original uploaded image
  prompt: varchar("prompt", { length: 1000 }), // User prompt used for generation
  tags: text("tags").array(), // User-defined tags for organization
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Prompt templates for AI image processing (Admin only)
export const promptTemplates = pgTable("prompt_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: varchar("description"),
  category: varchar("category").notNull().default("image-enhancement"),
  template: text("template").notNull(),
  variables: text("variables").array().default([]), // Variables found in template like {variable}
  isSystem: text("is_system").notNull().default("false"), // System templates vs custom
  enabled: text("enabled").notNull().default("true"), // Enable/disable template visibility
  usage: integer("usage").notNull().default(0), // Number of times used
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertImageProcessingJobSchema = createInsertSchema(imageProcessingJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertModelConfigurationSchema = createInsertSchema(modelConfigurations).omit({
  id: true,
  updatedAt: true,
});

export const insertSavedImageSchema = createInsertSchema(savedImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type ImageProcessingJob = typeof imageProcessingJobs.$inferSelect;
export type InsertImageProcessingJob = z.infer<typeof insertImageProcessingJobSchema>;

export type ModelConfiguration = typeof modelConfigurations.$inferSelect;
export type InsertModelConfiguration = z.infer<typeof insertModelConfigurationSchema>;

export type SavedImage = typeof savedImages.$inferSelect;
export type InsertSavedImage = z.infer<typeof insertSavedImageSchema>;

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;

// Relations for user context functionality
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  savedImages: many(savedImages),
  modelConfigurations: many(modelConfigurations),
  promptTemplates: many(promptTemplates),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  imageProcessingJobs: many(imageProcessingJobs),
}));

export const imageProcessingJobsRelations = relations(imageProcessingJobs, ({ one }) => ({
  message: one(messages, {
    fields: [imageProcessingJobs.messageId],
    references: [messages.id],
  }),
}));

export const modelConfigurationsRelations = relations(modelConfigurations, ({ one }) => ({
  user: one(users, {
    fields: [modelConfigurations.userId],
    references: [users.id],
  }),
}));

export const savedImagesRelations = relations(savedImages, ({ one }) => ({
  user: one(users, {
    fields: [savedImages.userId],
    references: [users.id],
  }),
}));

export const promptTemplatesRelations = relations(promptTemplates, ({ one }) => ({
  createdByUser: one(users, {
    fields: [promptTemplates.createdBy],
    references: [users.id],
  }),
}));

// User Context Types for better conversation handling
export type ConversationWithMessages = Conversation & {
  messages: Message[];
};

export type MessageWithJob = Message & {
  imageProcessingJobs?: ImageProcessingJob[];
};