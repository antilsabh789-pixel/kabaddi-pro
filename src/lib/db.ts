import { PrismaClient } from '@prisma/client'

// Ensure PostgreSQL URL is used even if shell has old SQLite URL
if (process.env.DATABASE_URL?.startsWith('file:')) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_kO2QUYoG6RJH@ep-wandering-tooth-aian558e-pooler.c-4.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require'
}
if (!process.env.DIRECT_URL || process.env.DIRECT_URL?.startsWith('file:')) {
  process.env.DIRECT_URL = 'postgresql://neondb_owner:npg_kO2QUYoG6RJH@ep-wandering-tooth-aian558e.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
