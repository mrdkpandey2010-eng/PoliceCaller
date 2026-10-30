import fs from 'node:fs';
import path from 'node:path';
import { LocalD1Database, D1Database } from './d1-adapter';

let globalDb: D1Database | null = null;

export function getDatabase(dbFilePath: string = ':memory:'): D1Database {
  if (!globalDb) {
    globalDb = new LocalD1Database(dbFilePath);
  }
  return globalDb;
}

export function setDatabase(db: D1Database): void {
  globalDb = db;
}

export async function applyMigrations(db: D1Database, migrationsDir?: string, seedsDir?: string): Promise<void> {
  const baseMigrationsDir = migrationsDir || path.resolve(process.cwd(), 'db/migrations');
  const baseSeedsDir = seedsDir || path.resolve(process.cwd(), 'db/seeds');

  // Apply schema migrations in sorted order
  if (fs.existsSync(baseMigrationsDir)) {
    const migrationFiles = fs
      .readdirSync(baseMigrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of migrationFiles) {
      const sql = fs.readFileSync(path.join(baseMigrationsDir, f), 'utf-8');
      await db.exec(sql);
    }
  }

  // Apply seeds
  const districtsSeed = path.join(baseSeedsDir, 'districts.sql');
  if (fs.existsSync(districtsSeed)) {
    const sql = fs.readFileSync(districtsSeed, 'utf-8');
    await db.exec(sql);
  }

  const desigSeed = path.join(baseSeedsDir, 'designations.sql');
  if (fs.existsSync(desigSeed)) {
    const sql = fs.readFileSync(desigSeed, 'utf-8');
    await db.exec(sql);
  }

  const initialDataSeed = path.join(baseSeedsDir, 'initial_data.sql');
  if (fs.existsSync(initialDataSeed)) {
    const sql = fs.readFileSync(initialDataSeed, 'utf-8');
    await db.exec(sql);
  }
}
