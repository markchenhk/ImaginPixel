import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  userId: text("user_id").notNull().default("default"), // For multi-user support later
  selectedModel: text("selected_model").notNull().default("gpt-4-vision"),
  outputQuality: text("output_quality").notNull().default("high"), // 'standard' | 'high' | 'ultra'
  maxResolution: integer("max_resolution").notNull().default(2048),
  timeout: integer("timeout").notNull().default(120), // seconds
  apiKeyConfigured: text("api_key_configured").notNull().default("false"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
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

// Types
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type ImageProcessingJob = typeof imageProcessingJobs.$inferSelect;
export type InsertImageProcessingJob = z.infer<typeof insertImageProcessingJobSchema>;

export type ModelConfiguration = typeof modelConfigurations.$inferSelect;
export type InsertModelConfiguration = z.infer<typeof insertModelConfigurationSchema>;
