#!/usr/bin/env node

/**
 * Database Synchronization Script for Replit PostgreSQL
 *
 * This script provides functionality to sync development and production databases:
 * - Backup database to file
 * - Restore database from file
 * - Sync production → development
 * - Sync development → production (with safety checks)
 * - Schema-only sync
 *
 * Usage:
 *   npm run db:sync backup dev
 *   npm run db:sync backup prod
 *   npm run db:sync restore dev backup.sql
 *   npm run db:sync prod-to-dev
 *   npm run db:sync dev-to-prod --confirm
 *   npm run db:sync schema prod-to-dev
 *
 * export DATABASE_URL="your-dev-database-url"
 * export PROD_DATABASE_URL="your-prod-database-url"
 * node scripts/db-sync.js [command]
 */

import { spawn, exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for PostgreSQL tool paths
let postgresToolPaths = null;

// Utility function to remove sslmode parameter from database URL
function removeSslMode(url) {
  if (!url) return url;
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete("sslmode");
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, try simple string replacement
    return url.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
  }
}

// Database connection parameters - read from environment variables (required)
const DATABASE_URL = removeSslMode(process.env.DATABASE_URL || "");
const PROD_DATABASE_URL = removeSslMode(
  process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || "",
);

// Validate required environment variables
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
if (!PROD_DATABASE_URL) {
  throw new Error(
    "PROD_DATABASE_URL environment variable is required (or falls back to DATABASE_URL)",
  );
}

// Configuration
const config = {
  dev: {
    url: DATABASE_URL,
    name: "Development",
  },
  prod: {
    url: PROD_DATABASE_URL,
    name: "Production",
  },
  backupDir: path.join(__dirname, "../backups"),
  excludedTables: ["sessions"], // Tables to exclude from sync
};

// Utility functions
function log(message, type = "info") {
  const timestamp = new Date().toISOString();
  const colors = {
    info: "\x1b[36m", // cyan
    success: "\x1b[32m", // green
    warning: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
    reset: "\x1b[0m", // reset
  };

  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, ...options.env },
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data;
      if (options.verbose) console.log(data.toString());
    });

    child.stderr?.on("data", (data) => {
      stderr += data;
      if (options.verbose) console.error(data.toString());
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

// Helper function for legacy exec calls where needed
function execShellCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Find PostgreSQL tool paths
async function findPostgreSQLTools() {
  if (postgresToolPaths) {
    return postgresToolPaths;
  }

  const tools = ["psql", "pg_dump", "pg_restore"];
  const paths = {};

  // First try known Nix store path (typical in Replit environment)
  const nixPostgresPath =
    "/nix/store/w7ldv9b1vc48a235g7ib2kjyqlrzfv0s-postgresql-16.9/bin";
  try {
    await fs.access(nixPostgresPath);
    for (const tool of tools) {
      const toolPath = path.join(nixPostgresPath, tool);
      try {
        await fs.access(toolPath);
        paths[tool] = toolPath;
      } catch {
        // Tool not found in this path
      }
    }
  } catch {
    // Nix path doesn't exist
  }

  // Fall back to which command for any missing tools
  for (const tool of tools) {
    if (!paths[tool]) {
      try {
        const { stdout } = await execShellCommand(`which ${tool}`);
        const toolPath = stdout.trim();
        if (toolPath) {
          await fs.access(toolPath);
          paths[tool] = toolPath;
        }
      } catch {
        // which command failed or tool not found
      }
    }
  }

  // Check if all required tools were found
  const missingTools = tools.filter((tool) => !paths[tool]);
  if (missingTools.length > 0) {
    throw new Error(
      `PostgreSQL tools not found: ${missingTools.join(", ")}. Please ensure PostgreSQL client tools are installed.`,
    );
  }

  postgresToolPaths = paths;
  log(
    `Found PostgreSQL tools: ${Object.entries(paths)
      .map(([tool, path]) => `${tool}=${path}`)
      .join(", ")}`,
  );
  return paths;
}

async function ensureBackupDir() {
  try {
    await fs.mkdir(config.backupDir, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

async function validateDatabaseUrl(url, name) {
  if (!url) {
    throw new Error(`${name} database URL not configured`);
  }

  // Test connection using environment variables for security
  try {
    const tools = await findPostgreSQLTools();
    const dbEnv = parseDbUrl(url);
    await execCommand(tools.psql, ["-c", "SELECT 1;", "-t", "-A"], {
      timeout: 10000,
      verbose: false,
      env: dbEnv,
    });
    log(`✓ ${name} database connection successful`);
  } catch (error) {
    throw new Error(`Failed to connect to ${name} database: ${error.message}`);
  }
}

function parseDbUrl(url) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    return {
      PGHOST: urlObj.hostname,
      PGPORT: urlObj.port || "5432",
      PGUSER: urlObj.username || "postgres",
      PGPASSWORD: urlObj.password || "",
      PGDATABASE: urlObj.pathname.slice(1) || "postgres",
    };
  } catch (error) {
    throw new Error(`Invalid database URL format: ${error.message}`);
  }
}

async function checkUrlsIdentical(fromUrl, toUrl, fromName, toName) {
  // Parse connection strings to compare essential components (host+port+database only)
  const parseUrl = (url) => {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: urlObj.port || "5432",
      database: urlObj.pathname.slice(1),
    };
  };

  try {
    const from = parseUrl(fromUrl);
    const to = parseUrl(toUrl);

    if (
      from.host === to.host &&
      from.port === to.port &&
      from.database === to.database
    ) {
      throw new Error(
        `Source and destination databases are identical! ` +
          `Cannot sync ${fromName} to ${toName} when they point to the same database. ` +
          `Please check your DATABASE_URL and PROD_DATABASE_URL configuration.`,
      );
    }
  } catch (error) {
    if (error.message.includes("identical")) {
      throw error;
    }
    // If URL parsing fails, continue with warning
    log(
      `⚠️  Could not parse database URLs for comparison: ${error.message}`,
      "warning",
    );
  }
}

// Core functions
async function backupDatabase(env) {
  const dbConfig = config[env];
  if (!dbConfig) {
    throw new Error(`Invalid environment: ${env}. Use 'dev' or 'prod'`);
  }

  await validateDatabaseUrl(dbConfig.url, dbConfig.name);
  await ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${env}-backup-${timestamp}.sql`;
  const filepath = path.join(config.backupDir, filename);

  log(`Creating backup of ${dbConfig.name} database...`);

  try {
    const tools = await findPostgreSQLTools();
    const dbEnv = parseDbUrl(dbConfig.url);

    // Use pg_dump with comprehensive options - custom format
    await execCommand(
      tools.pg_dump,
      [
        "--verbose",
        "--no-owner",
        "--no-acl",
        "--format=custom",
        `--file=${filepath}.dump`,
      ],
      { verbose: true, env: dbEnv },
    );

    // Also create a plain SQL version for manual inspection
    await execCommand(
      tools.pg_dump,
      ["--verbose", "--no-owner", "--no-acl", `--file=${filepath}`],
      { verbose: true, env: dbEnv },
    );

    log(`✓ Backup completed: ${filename}`, "success");
    log(`✓ Binary backup: ${filename}.dump`, "success");

    return { filepath, filename };
  } catch (error) {
    throw new Error(`Backup failed: ${error.message}`);
  }
}

async function restoreDatabase(env, backupFile) {
  const dbConfig = config[env];
  if (!dbConfig) {
    throw new Error(`Invalid environment: ${env}. Use 'dev' or 'prod'`);
  }

  await validateDatabaseUrl(dbConfig.url, dbConfig.name);

  const backupPath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(config.backupDir, backupFile);

  // Check if file exists
  try {
    await fs.access(backupPath);
  } catch {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  log(`Restoring ${dbConfig.name} database from ${backupFile}...`);

  // Confirm destructive operation
  if (env === "prod") {
    log(
      "⚠️  WARNING: You are about to restore PRODUCTION database!",
      "warning",
    );
    log("This will PERMANENTLY DELETE all current production data!", "warning");

    if (!process.argv.includes("--confirm")) {
      throw new Error("Production restore requires --confirm flag");
    }
  }

  try {
    const tools = await findPostgreSQLTools();
    const dbEnv = parseDbUrl(dbConfig.url);
    const isCustomFormat = backupFile.endsWith(".dump");

    if (isCustomFormat) {
      // Use pg_restore for custom format with proper flags
      await execCommand(
        tools.pg_restore,
        [
          "--verbose",
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-acl",
          "--exit-on-error",
          "--single-transaction",
          `--dbname=${dbEnv.PGDATABASE}`,
          backupPath,
        ],
        { verbose: true, env: dbEnv },
      );
    } else {
      // Use psql for SQL format
      await execCommand(
        tools.psql,
        ["-f", backupPath, "--set=ON_ERROR_STOP=1"],
        { verbose: true, env: dbEnv },
      );
    }

    log(`✓ Restore completed for ${dbConfig.name}`, "success");
  } catch (error) {
    throw new Error(`Restore failed: ${error.message}`);
  }
}

async function syncDatabase(from, to, schemaOnly = false) {
  const fromConfig = config[from];
  const toConfig = config[to];

  if (!fromConfig || !toConfig) {
    throw new Error(`Invalid environments. Use 'dev' or 'prod'`);
  }

  await validateDatabaseUrl(fromConfig.url, fromConfig.name);
  await validateDatabaseUrl(toConfig.url, toConfig.name);

  // Critical safety check: prevent syncing to same database
  await checkUrlsIdentical(
    fromConfig.url,
    toConfig.url,
    fromConfig.name,
    toConfig.name,
  );

  // Safety check for production
  if (to === "prod" && !process.argv.includes("--confirm")) {
    throw new Error("Syncing TO production requires --confirm flag");
  }

  log(
    `Syncing ${fromConfig.name} → ${toConfig.name}${schemaOnly ? " (schema only)" : ""}...`,
  );

  try {
    await ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempFile = path.join(config.backupDir, `temp-sync-${timestamp}.dump`);

    // Create custom format dump from source for better restore control
    const fromDbEnv = parseDbUrl(fromConfig.url);
    const toDbEnv = parseDbUrl(toConfig.url);

    const dumpArgs = [
      "--verbose",
      "--no-owner",
      "--no-acl",
      "--format=custom",
      `--file=${tempFile}`,
    ];

    if (schemaOnly) {
      dumpArgs.push("--schema-only");
      log("Creating schema-only dump...");
    } else {
      log("Creating full database dump...");
    }

    // Exclude specified tables (only for data sync, not schema-only)
    if (!schemaOnly) {
      for (const table of config.excludedTables) {
        dumpArgs.push(`--exclude-table=${table}`);
      }
    }

    const tools = await findPostgreSQLTools();
    await execCommand(tools.pg_dump, dumpArgs, {
      verbose: true,
      env: fromDbEnv,
    });

    // Restore to destination using pg_restore with proper cleanup
    log("Restoring to destination with cleanup...");
    const restoreArgs = [
      "--verbose",
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      "--single-transaction",
      `--dbname=${toDbEnv.PGDATABASE}`,
    ];

    if (schemaOnly) {
      restoreArgs.push("--schema-only");
    }

    restoreArgs.push(tempFile);

    await execCommand(tools.pg_restore, restoreArgs, {
      verbose: true,
      env: toDbEnv,
    });

    // Clean up
    await fs.unlink(tempFile);

    log(`✓ Sync completed: ${fromConfig.name} → ${toConfig.name}`, "success");
  } catch (error) {
    throw new Error(`Sync failed: ${error.message}`);
  }
}

async function listBackups() {
  await ensureBackupDir();

  try {
    const files = await fs.readdir(config.backupDir);
    const backups = files
      .filter((f) => f.endsWith(".sql") || f.endsWith(".dump"))
      .sort()
      .reverse(); // Most recent first

    if (backups.length === 0) {
      log("No backups found", "warning");
      return;
    }

    log("Available backups:");
    for (const backup of backups) {
      const filepath = path.join(config.backupDir, backup);
      const stats = await fs.stat(filepath);
      const size = (stats.size / 1024 / 1024).toFixed(2);
      log(`  ${backup} (${size} MB, ${stats.mtime.toISOString()})`);
    }
  } catch (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Database Synchronization Tool

Usage:
  node scripts/db-sync.js <command> [options]

Commands:
  backup <env>              Create backup (env: dev|prod)
  restore <env> <file>      Restore from backup file
  prod-to-dev              Sync production → development
  dev-to-prod --confirm    Sync development → production (requires confirmation)
  schema prod-to-dev       Sync only schema prod → dev
  schema dev-to-prod       Sync only schema dev → prod (requires --confirm)
  list                     List available backups

Examples:
  node scripts/db-sync.js backup dev
  node scripts/db-sync.js backup prod
  node scripts/db-sync.js restore dev dev-backup-2023-12-01.sql
  node scripts/db-sync.js prod-to-dev
  node scripts/db-sync.js dev-to-prod --confirm
  node scripts/db-sync.js schema prod-to-dev

Environment Variables:
  DATABASE_URL        Development database URL (required)
  PROD_DATABASE_URL   Production database URL (optional, falls back to DATABASE_URL)
`);
    process.exit(0);
  }

  try {
    const command = args[0];

    switch (command) {
      case "backup":
        if (!args[1]) throw new Error("Environment required: dev|prod");
        await backupDatabase(args[1]);
        break;

      case "restore":
        if (!args[1] || !args[2])
          throw new Error("Usage: restore <env> <backup-file>");
        await restoreDatabase(args[1], args[2]);
        break;

      case "prod-to-dev":
        await syncDatabase("prod", "dev");
        break;

      case "dev-to-prod":
        await syncDatabase("dev", "prod");
        break;

      case "schema":
        if (!args[1])
          throw new Error("Direction required: prod-to-dev|dev-to-prod");
        if (args[1] === "prod-to-dev") {
          await syncDatabase("prod", "dev", true);
        } else if (args[1] === "dev-to-prod") {
          await syncDatabase("dev", "prod", true);
        } else {
          throw new Error("Invalid direction. Use: prod-to-dev|dev-to-prod");
        }
        break;

      case "list":
        await listBackups();
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    log(error.message, "error");
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, "error");
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  log(`Uncaught Exception: ${error.message}`, "error");
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { backupDatabase, restoreDatabase, syncDatabase, listBackups };
