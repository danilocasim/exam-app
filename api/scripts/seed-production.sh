#!/bin/bash

# Production Database Seed Script
# Purpose: Populate initial exam types and seed questions to production Neon database
# Usage: ./scripts/seed-production.sh
# Environment: Requires DATABASE_URL environment variable (Neon pooled connection string)
# Note: Only runs seed.ts if seed function is configured in package.json

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}▶ Production Database Seed${NC}"

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}✗ Error: DATABASE_URL environment variable is not set${NC}"
  echo "Set DATABASE_URL to your Neon connection string:"
  echo "  export DATABASE_URL='postgresql://user:password@host-pooler.region.aws.neon.tech/db?sslmode=require'"
  exit 1
fi

echo -e "${GREEN}✓ DATABASE_URL is set${NC}"

# Verify node_modules and prisma CLI
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}▶ Installing dependencies...${NC}"
  npm install
fi

if [ ! -f "node_modules/.bin/prisma" ]; then
  echo -e "${RED}✗ Error: Prisma CLI not found. Install with: npm install${NC}"
  exit 1
fi

# Check if seed script exists
if [ ! -f "prisma/seed.ts" ]; then
  echo -e "${YELLOW}⊘ No seed.ts file found, skipping seed${NC}"
  exit 0
fi

# Check if package.json has prisma seed hook
if ! grep -q '"prisma": {' package.json || ! grep -q '"seed"' package.json; then
  echo -e "${YELLOW}⊘ Prisma seed hook not configured in package.json${NC}"
  echo "To enable seeding, add to package.json:"
  echo '  "prisma": { "seed": "ts-node prisma/seed.ts" }'
  exit 0
fi

echo -e "${YELLOW}▶ Checking if seeding is already done...${NC}"

# Count existing ExamType records
EXAM_TYPE_COUNT=$(npx prisma db execute --stdin <<EOF
SELECT COUNT(*) as count FROM "ExamType";
EOF
) || true

if [ -n "$EXAM_TYPE_COUNT" ] && ! echo "$EXAM_TYPE_COUNT" | grep -q "0"; then
  echo -e "${YELLOW}⊘ Database already contains exam types (count: $EXAM_TYPE_COUNT)${NC}"
  echo "Seed script skipped to prevent duplicate data."
  echo ""
  echo "To re-seed:"
  echo "  1. Reset database: npx prisma migrate reset (⚠️  caution: deletes all data)"
  echo "  2. Then run: ./scripts/seed-production.sh"
  exit 0
fi

echo -e "${YELLOW}▶ Running seed script...${NC}"
npx prisma db seed || {
  echo -e "${RED}✗ Seed script failed${NC}"
  echo "Troubleshooting:"
  echo "  1. Check prisma/seed.ts for errors"
  echo "  2. Verify DATABASE_URL points to correct database"
  echo "  3. Ensure migrations have been applied: ./scripts/migrate-production.sh"
  exit 1
}

echo ""
echo -e "${GREEN}✓ Seed completed successfully!${NC}"
echo ""
echo -e "${YELLOW}▶ Verifying seeded data...${NC}"
npx prisma db execute --stdin <<EOF
SELECT 
  COUNT(*) as total_exam_types,
  STRING_AGG(DISTINCT "name", ', ') as exam_names
FROM "ExamType";
EOF

echo ""
echo -e "${GREEN}✓ Seed verification complete!${NC}"
echo ""
echo "Database is now ready for production deployment."
echo "Next steps:"
echo "  1. Start application: npm run start:dev"
echo "  2. Test production endpoints: curl http://localhost:3000/health"
echo "  3. Deploy to Railway: git push origin 003-play-integrity"
