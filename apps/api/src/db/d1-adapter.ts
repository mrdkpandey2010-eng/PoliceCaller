import { DatabaseSync } from 'node:sqlite';
import { D1Database, D1PreparedStatement } from './types';

export * from './types';

export class LocalD1Database implements D1Database {
  private sqlite: DatabaseSync;

  constructor(filePath: string = ':memory:') {
    this.sqlite = new DatabaseSync(filePath);
  }

  getSqliteInstance(): DatabaseSync {
    return this.sqlite;
  }

  prepare(query: string): D1PreparedStatement {
    return new LocalD1PreparedStatement(this.sqlite, query);
  }

  async batch(statements: D1PreparedStatement[]): Promise<any[]> {
    this.sqlite.exec('BEGIN TRANSACTION');
    try {
      const results: any[] = [];
      for (const stmt of statements) {
        const res = await stmt.run();
        results.push(res);
      }
      this.sqlite.exec('COMMIT');
      return results;
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const start = Date.now();
    this.sqlite.exec(query);
    return { count: 1, duration: Date.now() - start };
  }
}

class LocalD1PreparedStatement implements D1PreparedStatement {
  private sqlite: DatabaseSync;
  private sql: string;
  private params: any[] = [];

  constructor(sqlite: DatabaseSync, sql: string) {
    this.sqlite = sqlite;
    this.sql = sql;
  }

  bind(...values: any[]): D1PreparedStatement {
    this.params = values;
    return this;
  }

  async all<T = any>(): Promise<{ results: T[]; success: boolean }> {
    try {
      const stmt = this.sqlite.prepare(this.sql);
      const rows = stmt.all(...this.params) as T[];
      return { results: rows, success: true };
    } catch (err: any) {
      console.error('SQL Error in all():', this.sql, this.params, err);
      throw err;
    }
  }

  async first<T = any>(colName?: string): Promise<T | null> {
    try {
      const stmt = this.sqlite.prepare(this.sql);
      const row = stmt.get(...this.params) as any;
      if (!row) return null;
      if (colName) return row[colName] ?? null;
      return row as T;
    } catch (err: any) {
      console.error('SQL Error in first():', this.sql, this.params, err);
      throw err;
    }
  }

  async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
    try {
      const stmt = this.sqlite.prepare(this.sql);
      const result = stmt.run(...this.params);
      return {
        success: true,
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    } catch (err: any) {
      console.error('SQL Error in run():', this.sql, this.params, err);
      throw err;
    }
  }
}
