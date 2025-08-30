import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool for serverless environment
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // Maximum number of connections
  idleTimeoutMillis: 30000,   // 30 seconds idle timeout
  connectionTimeoutMillis: 10000, // 10 seconds connection timeout
  maxUses: 7500,              // Max uses per connection before refresh
  allowExitOnIdle: false      // Don't allow exit while connections are idle
});

export const db = drizzle({ client: pool, schema });