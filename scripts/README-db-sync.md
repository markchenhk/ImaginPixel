# Database Synchronization Tool

This tool provides comprehensive database synchronization capabilities for your Replit PostgreSQL databases, including backup, restore, and sync operations between development and production environments.

## Prerequisites

- PostgreSQL client tools (`psql`, `pg_dump`, `pg_restore`) must be available
- Environment variables properly configured:
  - `DATABASE_URL`: Your development database connection string
  - `PROD_DATABASE_URL`: Your production database connection string (optional, defaults to `DATABASE_URL`)

## Quick Start

### Basic Usage

```bash
# Show help and available commands
node scripts/db-sync.js

# Create a backup of your development database
node scripts/db-sync.js backup dev

# Create a backup of your production database  
node scripts/db-sync.js backup prod

# List all available backups
node scripts/db-sync.js list

# Sync production data to development (safe operation)
node scripts/db-sync.js prod-to-dev

# Sync development to production (requires confirmation)
node scripts/db-sync.js dev-to-prod --confirm
```

## Available Commands

### Backup Operations

```bash
# Backup development database
node scripts/db-sync.js backup dev

# Backup production database
node scripts/db-sync.js backup prod
```

Creates both SQL and binary dump formats in the `backups/` directory with timestamps.

### Restore Operations

```bash
# Restore development database from backup
node scripts/db-sync.js restore dev backup-filename.sql

# Restore production database from backup (requires confirmation)
node scripts/db-sync.js restore prod backup-filename.sql --confirm
```

### Sync Operations

```bash
# Sync production → development (safe)
node scripts/db-sync.js prod-to-dev

# Sync development → production (destructive, requires confirmation)
node scripts/db-sync.js dev-to-prod --confirm

# Sync only schema (no data) production → development
node scripts/db-sync.js schema prod-to-dev

# Sync only schema (no data) development → production
node scripts/db-sync.js schema dev-to-prod --confirm
```

### Utility Commands

```bash
# List all available backups with sizes and dates
node scripts/db-sync.js list
```

## Optional: Add to package.json Scripts

If you want convenient npm script shortcuts, you can manually add these to your `package.json` scripts section:

```json
{
  "scripts": {
    "db:sync": "node scripts/db-sync.js",
    "db:backup:dev": "node scripts/db-sync.js backup dev",
    "db:backup:prod": "node scripts/db-sync.js backup prod",
    "db:restore:dev": "node scripts/db-sync.js restore dev",
    "db:restore:prod": "node scripts/db-sync.js restore prod",
    "db:prod-to-dev": "node scripts/db-sync.js prod-to-dev",
    "db:dev-to-prod": "node scripts/db-sync.js dev-to-prod --confirm",
    "db:schema:prod-to-dev": "node scripts/db-sync.js schema prod-to-dev",
    "db:schema:dev-to-prod": "node scripts/db-sync.js schema dev-to-prod --confirm",
    "db:list": "node scripts/db-sync.js list"
  }
}
```

Then you can use:
```bash
npm run db:backup:dev
npm run db:prod-to-dev
npm run db:list
```

## Safety Features

### Production Protection
- All operations targeting production require the `--confirm` flag
- Clear warnings are displayed before destructive operations
- Connection validation ensures database availability before operations

### Excluded Tables
- The `sessions` table is excluded from sync operations by default
- You can modify the `excludedTables` array in the script to customize this

### Backup Management
- Backups are stored in the `backups/` directory with timestamps
- Both SQL and binary formats are created for flexibility
- Automatic directory creation if not exists

## File Formats

The tool creates two backup formats:

1. **SQL Format** (`.sql`): Human-readable, can be inspected and modified
2. **Binary Format** (`.dump`): Compressed binary format, faster for large databases

## Environment Configuration

### Development Only Setup
If you only have one database, set:
```bash
DATABASE_URL=your_database_connection_string
```

### Development + Production Setup
For separate environments, set:
```bash
DATABASE_URL=your_dev_database_connection_string
PROD_DATABASE_URL=your_prod_database_connection_string
```

## Common Workflows

### Daily Development Sync
```bash
# Get latest production data in development
node scripts/db-sync.js prod-to-dev
```

### Pre-deployment Backup
```bash
# Backup production before deployment
node scripts/db-sync.js backup prod
```

### Schema Updates
```bash
# Push schema changes to production (data preserved)
node scripts/db-sync.js schema dev-to-prod --confirm
```

### Rollback Scenario
```bash
# List backups to find the right one
node scripts/db-sync.js list

# Restore from backup
node scripts/db-sync.js restore prod prod-backup-2024-01-15T10-30-00.sql --confirm
```

## Troubleshooting

### Connection Issues
- Verify your database URLs are correct
- Check if PostgreSQL client tools are installed
- Ensure database is accessible from your current environment

### Permission Issues
- Make sure the script is executable: `chmod +x scripts/db-sync.js`
- Verify your database user has necessary permissions

### Large Database Handling
- For very large databases, consider using the binary format (`.dump`) 
- The tool uses custom format with compression for efficiency

## Security Notes

- Database URLs may contain sensitive credentials
- Backup files contain your database data - store securely
- Production operations require explicit confirmation to prevent accidents
- The script validates connections before performing operations

## Extending the Tool

The script is modular and can be extended:
- Modify `excludedTables` array for different table exclusions
- Add custom backup retention policies
- Integrate with external storage for backup archival
- Add Slack/email notifications for sync operations

For questions or issues, refer to the inline code comments in `scripts/db-sync.js`.