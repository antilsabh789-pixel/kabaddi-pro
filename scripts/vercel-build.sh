#!/bin/bash
# Vercel Build Script
# Switches Prisma from SQLite to PostgreSQL for Vercel deployment

set -e

echo "🔧 Switching Prisma to PostgreSQL for Vercel..."

# Replace SQLite provider with PostgreSQL in schema.prisma
sed -i 's/provider = "sqlite"/provider = "postgresql"/g' prisma/schema.prisma

echo "✅ Prisma provider switched to PostgreSQL"

# Generate Prisma client
npx prisma generate

echo "✅ Prisma client generated for PostgreSQL"

# Build Next.js
npx next build

echo "🎉 Vercel build complete!"
