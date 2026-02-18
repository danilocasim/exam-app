#!/bin/bash

# Production Database Migration Script
# Purpose: Apply all pending Prisma migrations to production Neon database
# Usage: ./scripts/migrate-production.sh
# Environment: Requires DATABASE_URL environment variable (Neon pooled connection string)

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}▶ Production Database Migration${NC}"

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}✗ Error: DATABASE_URL environment variable is not set${NC}"
  echo "Set DATABASE_URL to your Neon connection string:"
  echo "  export DATABASE_URL='postgresql://user:password@host-pooler.region.aws.neon.tech/db?sslmode=require'"
  exit 1
fi

echo -e "${GREEN}✓ DATABASE_URL is set${NC}"
echo "  Database: ${DATABASE_URL%\?*}" | grep -oE "@[^/]*" || true

# Verify node_modules and prisma CLI
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}▶ Installing dependencies...${NC}"
  npm install
fi

if [ ! -f "node_modules/.bin/prisma" ]; then
  echo -e "${RED}✗ Error: Prisma CLI not found. Install with: npm install${NC}"
  exit 1
fi

echo -e "${YELLOW}▶ Checking migration status...${NC}"
npx prisma migrate status || {
  echo -e "${RED}✗ Migration status check failed${NC}"
  exit 1
}

echo -e "${YELLOW}▶ Applying pending migrations...${NC}"
npx prisma migrate deploy || {
  echo -e "${RED}✗ Migration deployment failed${NC}"
  echo "Troubleshooting:"
  echo "  1. Verify DATABASE_URL is correct and database is accessible"
  echo "  2. Check Neon console for any database issues"
  echo "  3. Ensure all local migrations are committed (git status)"
  exit 1
}

echo -e "${GREEN}✓ Migrations applied successfully${NC}"
echo ""
echo -e "${YELLOW}▶ Connected to database at:${NC}"
npx prisma db execute --stdin <<EOF
SELECT version();
EOF

echo ""
echo -e "${GREEN}✓ Migration complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run seed script: ./scripts/seed-production.sh"
echo "  2. Verify data in Neon console: https://console.neon.tech"
echo "  3. Monitor application startup: npm run start:dev"
