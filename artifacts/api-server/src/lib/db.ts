import path from 'path';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env['SQLITE_DATABASE_URL'] || `file:${path.join(process.cwd(), 'prisma', 'custom.db')}`;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

if (process.env['NODE_ENV'] !== 'production') globalForPrisma.prisma = db;
