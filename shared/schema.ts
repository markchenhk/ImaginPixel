import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer, index, jsonb } from "drizzle-orm/pg-core";
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
  userId: text("user_id").notNull().default("default").unique(), // Make userId unique for conflict resolution
  selectedModel: text("selected_model").notNull().default("google/gemini-2.5-flash-image"),
  outputQuality: text("output_quality").notNull().default("high"), // 'standard' | 'high' | 'ultra'
  maxResolution: integer("max_resolution").notNull().default(2048),
  timeout: integer("timeout").notNull().default(120), // seconds
  apiKey: text("api_key"), // OpenRouter API key storage
  openaiApiKey: text("openai_api_key"), // OpenAI API key for DALL-E 3
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

// Relations for user context functionality
export const conversationsRelations = relations(conversations, ({ many }) => ({
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

// User Context Types for better conversation handling
export type ConversationWithMessages = Conversation & {
  messages: Message[];
};

export type MessageWithJob = Message & {
  imageProcessingJobs?: ImageProcessingJob[];
};

// Session storage table for Replit Auth.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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

export const savedImagesRelations = relations(savedImages, ({ one }) => ({
  user: one(users, {
    fields: [savedImages.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  savedImages: many(savedImages),
}));

export type SavedImage = typeof savedImages.$inferSelect;
export type InsertSavedImage = typeof savedImages.$inferInsert;

// Insert schema for saved images
export const insertSavedImageSchema = createInsertSchema(savedImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
