#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until node -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined }); client.connect().then(() => client.end()).then(() => process.exit(0)).catch(() => process.exit(1));"
do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready."

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Seeding irregular historical market data..."
npm run seed

echo "Starting backend..."
exec "$@"
