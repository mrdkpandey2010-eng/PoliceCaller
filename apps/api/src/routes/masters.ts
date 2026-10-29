import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from '../services/auth';
import {
  CreateDistrictSchema,
  CreateStationOfficeSchema,
  CreateDesignationSchema,
  ROLES,
} from '@police-directory/shared';

export function createMastersRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // GET /api/masters/districts - All 75 UP Districts
  router.get('/districts', async (c) => {
    const { results } = await db
      .prepare('SELECT id, code, name, zone, range, is_active as isActive FROM districts WHERE is_active = 1 ORDER BY name ASC')
      .all();
    return c.json({ districts: results });
  });

  // POST /api/masters/districts - Create District (Super Admin only)
  router.post('/districts', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    try {
      const body = await c.req.json();
      const validated = CreateDistrictSchema.parse(body);

      const districtId = `dist_${validated.code.toLowerCase()}`;
      await db
        .prepare(
          `INSERT INTO districts (id, code, name, zone, range, is_active) VALUES (?, ?, ?, ?, ?, 1)`
        )
        .bind(districtId, validated.code, validated.name, validated.zone || null, validated.range || null)
        .run();

      return c.json({ success: true, districtId });
    } catch (err: any) {
      return c.json({ error: err.message }, 422);
    }
  });

  // GET /api/masters/stations - Stations for selected district
  router.get('/stations', async (c) => {
    const districtId = c.req.query('districtId');
    let sql = 'SELECT id, district_id as districtId, name, type, address, phone, is_active as isActive FROM stations_offices WHERE is_active = 1';
    const params: any[] = [];
    if (districtId) {
      sql += ' AND district_id = ?';
      params.push(districtId);
    }
    sql += ' ORDER BY name ASC';
    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ stations: results });
  });

  // POST /api/masters/stations - Create Station (Super Admin only)
  router.post('/stations', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    try {
      const body = await c.req.json();
      const validated = CreateStationOfficeSchema.parse(body);

      const stationId = `stn_${crypto.randomUUID()}`;
      await db
        .prepare(
          `INSERT INTO stations_offices (id, district_id, name, type, address, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`
        )
        .bind(stationId, validated.districtId, validated.name, validated.type, validated.address || null, validated.phone || null)
        .run();

      return c.json({ success: true, stationId });
    } catch (err: any) {
      return c.json({ error: err.message }, 422);
    }
  });

  // GET /api/masters/designations - Designations in rank order
  router.get('/designations', async (c) => {
    const { results } = await db
      .prepare('SELECT id, code, name, short_name as shortName, rank_order as rankOrder, is_active as isActive FROM designations WHERE is_active = 1 ORDER BY rank_order ASC')
      .all();
    return c.json({ designations: results });
  });

  // POST /api/masters/designations - Create Designation (Super Admin only)
  router.post('/designations', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    try {
      const body = await c.req.json();
      const validated = CreateDesignationSchema.parse(body);

      const desigId = `desig_${validated.code.toLowerCase()}`;
      await db
        .prepare(
          `INSERT INTO designations (id, code, name, short_name, rank_order, is_active) VALUES (?, ?, ?, ?, ?, 1)`
        )
        .bind(desigId, validated.code, validated.name, validated.shortName, validated.rankOrder)
        .run();

      return c.json({ success: true, designationId: desigId });
    } catch (err: any) {
      return c.json({ error: err.message }, 422);
    }
  });

  // GET /api/masters/policies - Active Versioned Policies
  router.get('/policies', async (c) => {
    const type = c.req.query('type') || 'TERMS';
    const policy = await db
      .prepare(
        `SELECT id, version, title_en as titleEn, title_hi as titleHi, content_en as contentEn, content_hi as contentHi, type, published_at as publishedAt
         FROM policies 
         WHERE type = ? AND is_active = 1 
         ORDER BY published_at DESC LIMIT 1`
      )
      .bind(type)
      .first<any>();

    return c.json({ policy });
  });

  return router;
}
