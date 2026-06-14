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

# Push schema to database (adds missing columns, keeps existing data)
# Use --accept-data-loss only if schema changes require column removal
npx prisma db push --accept-data-loss

echo "✅ Database schema synced"

# Build Next.js
npx next build

echo "🎉 Vercel build complete!"
