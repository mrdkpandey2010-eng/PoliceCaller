import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runMigrations() {
  console.log('--- UP Police D1 Database Migration ---');
  const dbPath = path.join(rootDir, 'local_d1.sqlite');
  const db = new DatabaseSync(dbPath);

  const files = [
    path.join(rootDir, 'db/migrations/0001_initial_schema.sql'),
    path.join(rootDir, 'db/migrations/0002_v4_targeted_fixes.sql'),
    path.join(rootDir, 'db/migrations/0003_v5_directory_transfers_settings.sql'),
    path.join(rootDir, 'db/seeds/districts.sql'),
    path.join(rootDir, 'db/seeds/designations.sql'),
    path.join(rootDir, 'db/seeds/police_stations_1878.sql'),
    path.join(rootDir, 'db/seeds/initial_data.sql'),
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      console.log('Applying:', path.basename(file));
      const sql = fs.readFileSync(file, 'utf-8');
      db.exec(sql);
    }
  }

  console.log('✓ Successfully applied schema & seed files to SQLite DB:', dbPath);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
