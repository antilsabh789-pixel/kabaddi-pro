#!/bin/bash
export DATABASE_URL="postgresql://neondb_owner:npg_kO2QUYoG6RJH@ep-wandering-tooth-aian558e-pooler.c-4.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require"
export DIRECT_URL="postgresql://neondb_owner:npg_kO2QUYoG6RJH@ep-wandering-tooth-aian558e.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
cd /home/z/my-project
# Use exec to replace shell with the bun process
exec bun run dev
