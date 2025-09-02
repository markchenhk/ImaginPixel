-- Initialize AI Product Studio Database
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the database if it doesn't exist (this is handled by POSTGRES_DB env var)
-- But we can add any additional initialization here

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ai_product_studio TO postgres;

-- Create some initial configuration if needed
-- This will be overridden by the application's schema migration
-- But ensures the database is ready for connections