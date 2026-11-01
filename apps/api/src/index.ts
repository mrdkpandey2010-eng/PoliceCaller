import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { D1Database } from './db/types';
import { validateSession, AuthenticatedUser } from './services/auth';
import { createAuthRouter } from './routes/auth';
import { createDirectoryRouter } from './routes/directory';
import { createTransfersRouter } from './routes/transfers';
import { createChatRouter } from './routes/chat';
import { createNoticesRouter } from './routes/notices';
import { createAdminRouter } from './routes/admin';
import { createExcelRouter } from './routes/excel';
import { createMastersRouter } from './routes/masters';
import { createDiariesRouter } from './routes/diaries';
import { createFeedbackRouter } from './routes/feedback';

export interface Env {
  DB: D1Database;
  APP_ENV?: string;
}

export function createApp(dbInstance?: D1Database) {
  const app = new Hono<{
    Bindings: Env;
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  const fallbackDb: D1Database = {
    prepare(_query: string) {
      return {
        bind(..._values: any[]) { return this; },
        async all() { return { results: [], success: true }; },
        async first() { return null; },
        async run() { return { success: true, meta: { changes: 0, last_row_id: 0 } }; },
      };
    },
    async batch() { return []; },
    async exec() { return { count: 0, duration: 0 }; },
  };

  // CORS middleware
  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    })
  );

  // Database resolution
  app.use('*', async (c, next) => {
    const db = dbInstance || (c.env && c.env.DB ? c.env.DB : fallbackDb);
    c.set('db' as any, db);
    await next();
  });

  // Authentication Middleware
  app.use('*', async (c, next) => {
    const path = c.req.path;
    const publicPaths = [
      '/api/health',
      '/api/auth/lookup',
      '/api/auth/login',
      '/api/auth/register',
      '/api/masters/districts',
      '/api/masters/stations',
      '/api/masters/designations',
      '/api/masters/policies',
    ];

    const isPublic = publicPaths.some((p) => path.startsWith(p));
    const authHeader = c.req.header('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    const db: D1Database = (c.get as any)('db');

    if (token) {
      const user = await validateSession(db, token);
      if (user) {
        c.set('user', user);
      }
    }

    if (!isPublic && !c.get('user')) {
      return c.json({ error: 'Unauthorized: Valid authentication token required.' }, 401);
    }

    await next();
  });

  // Health endpoint (safe: no secret leakage)
  app.get('/api/health', (c) => {
    return c.json({
      status: 'UP',
      service: 'UP Police Directory & Realtime Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount routers
  const targetDb = dbInstance || fallbackDb;

  app.route('/api/auth', createAuthRouter(targetDb));
  app.route('/api/directory', createDirectoryRouter(targetDb));
  app.route('/api/transfers', createTransfersRouter(targetDb));
  app.route('/api/chat', createChatRouter(targetDb));
  app.route('/api/notices', createNoticesRouter(targetDb));
  app.route('/api/admin', createAdminRouter(targetDb));
  app.route('/api/admin/excel', createExcelRouter(targetDb));
  app.route('/api/masters', createMastersRouter(targetDb));
  app.route('/api/diaries', createDiariesRouter(targetDb));
  app.route('/api/feedback', createFeedbackRouter(targetDb));

  return app;
}

// Default export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: any) {
    const app = createApp(env.DB);
    return app.fetch(request, env, ctx);
  },
};
