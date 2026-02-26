/**
 * SQLite database adapter using sql.js (WebAssembly-based SQLite).
 *
 * Manages the pre-built SEO reference database shipped with the package.
 * Falls back gracefully if the database file is not found.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { getConfig } from '../config/defaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initSqlJsFn: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let dbReady = false;

async function loadSqlJs() {
  if (!initSqlJsFn) {
    const sqljs = await import('sql.js');
    initSqlJsFn = sqljs.default;
  }
  return initSqlJsFn;
}

export async function openDatabase(): Promise<void> {
  if (dbReady) return;

  try {
    const SQL = await loadSqlJs();
    const config = getConfig();
    const dbPath = resolve(config.dbPath);

    if (existsSync(dbPath)) {
      const buffer = readFileSync(dbPath);
      db = new SQL({ data: buffer });
      logger.info(`Database loaded from ${dbPath}`);
    } else {
      db = new SQL();
      logger.info('Created new in-memory database');

      // Initialize schema from co-located schema.sql
      const schemaPath = join(__dirname, 'schema.sql');
      if (existsSync(schemaPath)) {
        const schema = readFileSync(schemaPath, 'utf-8');
        db.run(schema);
        logger.info('Database schema initialized');
      }
    }

    dbReady = true;
  } catch (error) {
    logger.warn('Failed to initialize database:', error);
    dbReady = false;
  }
}

export function getDb(): any {
  return db;
}

export function isDbReady(): boolean {
  return dbReady;
}

export function runQuery(sql: string, params: unknown[] = []): any[] {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (error) {
    logger.error('Database query error:', error);
    return [];
  }
}

export function runExec(sql: string): void {
  if (!db) return;
  try {
    db.run(sql);
  } catch (error) {
    logger.error('Database exec error:', error);
  }
}

export function saveDatabase(): void {
  if (!db) return;

  try {
    const config = getConfig();
    const dbPath = resolve(config.dbPath);
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
    logger.info(`Database saved to ${dbPath}`);
  } catch (error) {
    logger.error('Failed to save database:', error);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    dbReady = false;
    logger.info('Database closed');
  }
}
