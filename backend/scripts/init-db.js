import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(rootDir, 'backend/.env') });

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
  multipleStatements: true
};

const databaseName = process.env.DB_NAME || 'demo_app';
const sqlPath = path.join(rootDir, 'database/init.sql');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry() {
  let lastError;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      return await mysql.createConnection(config);
    } catch (error) {
      lastError = error;
      console.log(`Waiting for MySQL (${attempt}/30)...`);
      await sleep(2000);
    }
  }

  throw lastError;
}

const connection = await connectWithRetry();

try {
  const sql = await fs.readFile(sqlPath, 'utf8');
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
  await connection.query(sql);
  console.log(`Database '${databaseName}' initialized successfully.`);
} finally {
  await connection.end();
}
