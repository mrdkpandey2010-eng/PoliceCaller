import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from '../services/auth';
import { logAuditEvent } from '../services/audit';
import {
  CreateDistrictSchema,
  CreateStationOfficeSchema,
  CreateDesignationSchema,
  ROLES,
} from '@police-directory/shared';

// Helper for validating English-only canonical structured names
function validateEnglishMasterName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2) return { valid: false, error: 'Name must be at least 2 characters' };
  if (trimmed.length > 80) return { valid: false, error: 'Name cannot exceed 80 characters' };
  // Accept English letters, digits (e.g. Sector 18, Phase 2, Line 1), spaces, apostrophes, hyphens, and dots
  if (!/^[A-Za-z][A-Za-z0-9 .'-]*[A-Za-z0-9.]$/.test(trimmed)) {
    return { valid: false, error: 'Name must contain English letters and characters only (no Hindi/Devanagari).' };
  }
  if (/\.{2,}|-{2,}|'{2,}/.test(trimmed)) {
    return { valid: false, error: 'Name cannot contain repeated punctuation.' };
  }
  return { valid: true };
}

export function createMastersRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // -------------------------------------------------------------
  // 1. DISTRICTS
  // -------------------------------------------------------------

  // GET /api/masters/districts
  router.get('/districts', async (c) => {
    const user = c.get('user');
    const showAll = c.req.query('all') === 'true' && user?.role === ROLES.SUPER_ADMIN;
    const search = c.req.query('search')?.trim().toLowerCase();

    let sql = 'SELECT id, code, name, zone, range, is_active as isActive FROM districts';
    const params: any[] = [];
    const conditions: string[] = [];

    if (!showAll) {
      conditions.push('is_active = 1');
    }

    if (search) {
      conditions.push('(LOWER(name) LIKE ? OR LOWER(code) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY name ASC';
    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ districts: results });
  });

  // POST /api/masters/districts (Super Admin only)
  router.post('/districts', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    try {
      const body = await c.req.json();
      const validated = CreateDistrictSchema.parse(body);

      const nameCheck = validateEnglishMasterName(validated.name);
      if (!nameCheck.valid) {
        return c.json({ error: nameCheck.error }, 422);
      }

      // Check duplicates
      const existing = await db
        .prepare('SELECT id FROM districts WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)')
        .bind(validated.name.trim(), validated.code.trim())
        .first();

      if (existing) {
        return c.json({ error: 'A district with this name or code already exists.' }, 409);
      }

      const districtId = `dist_${validated.code.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO districts (id, code, name, zone, range, is_active, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .bind(
          districtId,
          validated.code.trim().toUpperCase(),
          validated.name.trim(),
          validated.zone?.trim() || null,
          validated.range?.trim() || null,
          now,
          now
        )
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'CREATE_DISTRICT',
        entityType: 'DISTRICT',
        entityId: districtId,
        afterState: { code: validated.code, name: validated.name },
      });

      return c.json({ success: true, districtId, message: `District ${validated.name} created successfully.` });
    } catch (err: any) {
      if (err.errors) {
        return c.json({ error: 'Validation failed', details: err.errors }, 422);
      }
      return c.json({ error: err.message || 'Failed to create district' }, 400);
    }
  });

  // PUT /api/masters/districts/:id (Super Admin only)
  router.put('/districts/:id', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    const districtId = c.req.param('id');
    try {
      const body = await c.req.json();
      const { name, code, zone, range } = body;

      const target = await db.prepare('SELECT * FROM districts WHERE id = ?').bind(districtId).first<any>();
      if (!target) return c.json({ error: 'District not found' }, 404);

      if (name) {
        const nameCheck = validateEnglishMasterName(name);
        if (!nameCheck.valid) return c.json({ error: nameCheck.error }, 422);
      }

      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE districts 
           SET name = IFNULL(?, name),
               code = IFNULL(?, code),
               zone = IFNULL(?, zone),
               range = IFNULL(?, range),
               updated_at = ?
           WHERE id = ?`
        )
        .bind(name?.trim() || null, code?.trim()?.toUpperCase() || null, zone?.trim() || null, range?.trim() || null, now, districtId)
        .run();

      return c.json({ success: true, message: 'District updated successfully.' });
    } catch (err: any) {
      return c.json({ error: err.message || 'Update failed' }, 400);
    }
  });

  // POST /api/masters/districts/:id/toggle-active (Super Admin only)
  router.post('/districts/:id/toggle-active', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    const districtId = c.req.param('id');
    const target = await db.prepare('SELECT id, is_active, name FROM districts WHERE id = ?').bind(districtId).first<any>();
    if (!target) return c.json({ error: 'District not found' }, 404);

    const newActive = target.is_active === 1 ? 0 : 1;
    await db.prepare('UPDATE districts SET is_active = ?, updated_at = ? WHERE id = ?').bind(newActive, new Date().toISOString(), districtId).run();

    await logAuditEvent(db, {
      actor: user,
      action: newActive ? 'ACTIVATE_DISTRICT' : 'DEACTIVATE_DISTRICT',
      entityType: 'DISTRICT',
      entityId: districtId,
      beforeState: { isActive: target.is_active },
      afterState: { isActive: newActive },
    });

    return c.json({ success: true, isActive: newActive, message: `District ${target.name} ${newActive ? 'activated' : 'deactivated'}.` });
  });

  // DELETE /api/masters/districts/:id (Super Admin only)
  router.delete('/districts/:id', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    const districtId = c.req.param('id');
    const target = await db.prepare('SELECT id, name FROM districts WHERE id = ?').bind(districtId).first<any>();
    if (!target) return c.json({ error: 'District not found' }, 404);

    // Check if referenced by stations or personnel
    const stationCount = await db.prepare('SELECT count(*) as cnt FROM stations_offices WHERE district_id = ?').bind(districtId).first<any>();
    const userCount = await db.prepare('SELECT count(*) as cnt FROM users WHERE district_id = ?').bind(districtId).first<any>();

    if ((stationCount?.cnt || 0) > 0 || (userCount?.cnt || 0) > 0) {
      return c.json(
        {
          error: `Cannot delete district "${target.name}" because it is referenced by ${stationCount?.cnt || 0} station(s) and ${userCount?.cnt || 0} personnel. Please deactivate the district instead to preserve historical records.`,
          cannotDelete: true,
        },
        400
      );
    }

    await db.prepare('DELETE FROM districts WHERE id = ?').bind(districtId).run();
    return c.json({ success: true, message: `District ${target.name} deleted.` });
  });

  // -------------------------------------------------------------
  // 2. STATIONS & OFFICES
  // -------------------------------------------------------------

  // GET /api/masters/stations
  router.get('/stations', async (c) => {
    const user = c.get('user');
    const showAll = c.req.query('all') === 'true' && user?.role === ROLES.SUPER_ADMIN;
    const districtId = c.req.query('districtId');
    const typeFilter = c.req.query('type');
    const search = c.req.query('search')?.trim().toLowerCase();

    let sql = `
      SELECT s.id, s.district_id as districtId, d.name as districtName,
             s.name, s.type, s.address, s.phone, s.is_active as isActive
      FROM stations_offices s
      JOIN districts d ON s.district_id = d.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (!showAll) {
      conditions.push('s.is_active = 1');
    }

    if (districtId) {
      conditions.push('s.district_id = ?');
      params.push(districtId);
    }

    if (typeFilter) {
      if (typeFilter === 'POLICE_STATION') {
        conditions.push("s.type = 'POLICE_STATION'");
      } else if (typeFilter === 'OFFICE') {
        conditions.push("s.type != 'POLICE_STATION'");
      } else {
        conditions.push('s.type = ?');
        params.push(typeFilter);
      }
    }

    if (search) {
      conditions.push('(LOWER(s.name) LIKE ? OR LOWER(d.name) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY d.name ASC, s.name ASC';
    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ stations: results });
  });

  // POST /api/masters/stations (Super Admin only)
  router.post('/stations', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    try {
      const body = await c.req.json();
      const validated = CreateStationOfficeSchema.parse(body);

      const nameCheck = validateEnglishMasterName(validated.name);
      if (!nameCheck.valid) {
        return c.json({ error: nameCheck.error }, 422);
      }

      // Check district exists
      const dist = await db.prepare('SELECT id, name FROM districts WHERE id = ?').bind(validated.districtId).first<any>();
      if (!dist) {
        return c.json({ error: 'Selected district does not exist.' }, 404);
      }

      // Check duplicate within district
      const existing = await db
        .prepare('SELECT id FROM stations_offices WHERE district_id = ? AND LOWER(name) = LOWER(?)')
        .bind(validated.districtId, validated.name.trim())
        .first();

      if (existing) {
        return c.json({ error: `A station/office named "${validated.name}" already exists in ${dist.name}.` }, 409);
      }

      const stationId = `stn_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO stations_offices (id, district_id, name, type, address, phone, is_active, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .bind(stationId, validated.districtId, validated.name.trim(), validated.type, validated.address?.trim() || null, validated.phone?.trim() || null, now, now)
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'CREATE_STATION_OFFICE',
        entityType: 'STATION_OFFICE',
        entityId: stationId,
        districtScope: validated.districtId,
        afterState: { name: validated.name, type: validated.type, districtId: validated.districtId },
      });

      return c.json({ success: true, stationId, message: `${validated.type === 'POLICE_STATION' ? 'Police Station' : 'Office'} created successfully.` });
    } catch (err: any) {
      if (err.errors) {
        return c.json({ error: 'Validation failed', details: err.errors }, 422);
      }
      return c.json({ error: err.message || 'Failed to create station/office' }, 400);
    }
  });

  // PUT /api/masters/stations/:id (Super Admin full edit, District Co-Admin phone-only edit)
  router.put('/stations/:id', async (c) => {
    const user = c.get('user');
    if (!user || (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.DISTRICT_CO_ADMIN)) {
      return c.json({ error: 'Administrative authority required' }, 403);
    }
    const stationId = c.req.param('id');
    try {
      const body = await c.req.json();
      const { name, type, address, phone } = body;

      const target = await db.prepare('SELECT * FROM stations_offices WHERE id = ?').bind(stationId).first<any>();
      if (!target) return c.json({ error: 'Station/Office not found' }, 404);

      if (user.role === ROLES.DISTRICT_CO_ADMIN) {
        if (target.district_id !== user.districtId) {
          return c.json({ error: 'Forbidden: You may only edit stations/offices in your assigned district.' }, 403);
        }
        if (
          (name !== undefined && name !== target.name) ||
          (type !== undefined && type !== target.type) ||
          (address !== undefined && address !== target.address)
        ) {
          return c.json({ error: 'District Co-Admins are strictly authorized to edit station/office phone numbers only.' }, 403);
        }
      }

      if (name && user.role === ROLES.SUPER_ADMIN) {
        const nameCheck = validateEnglishMasterName(name);
        if (!nameCheck.valid) return c.json({ error: nameCheck.error }, 422);
      }

      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE stations_offices 
           SET name = IFNULL(?, name),
               type = IFNULL(?, type),
               address = IFNULL(?, address),
               phone = IFNULL(?, phone),
               updated_at = ?
           WHERE id = ?`
        )
        .bind(
          user.role === ROLES.SUPER_ADMIN ? (name?.trim() || null) : null,
          user.role === ROLES.SUPER_ADMIN ? (type || null) : null,
          user.role === ROLES.SUPER_ADMIN ? (address?.trim() || null) : null,
          phone?.trim() || null,
          now,
          stationId
        )
        .run();

      return c.json({ success: true, message: 'Station/Office updated successfully.' });
    } catch (err: any) {
      return c.json({ error: err.message || 'Update failed' }, 400);
    }
  });

  // POST /api/masters/stations/:id/toggle-active (Super Admin only)
  router.post('/stations/:id/toggle-active', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    const stationId = c.req.param('id');
    const target = await db.prepare('SELECT id, is_active, name FROM stations_offices WHERE id = ?').bind(stationId).first<any>();
    if (!target) return c.json({ error: 'Station/Office not found' }, 404);

    const newActive = target.is_active === 1 ? 0 : 1;
    await db.prepare('UPDATE stations_offices SET is_active = ?, updated_at = ? WHERE id = ?').bind(newActive, new Date().toISOString(), stationId).run();

    return c.json({ success: true, isActive: newActive, message: `${target.name} ${newActive ? 'activated' : 'deactivated'}.` });
  });

  // DELETE /api/masters/stations/:id (Super Admin only)
  router.delete('/stations/:id', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    const stationId = c.req.param('id');
    const target = await db.prepare('SELECT id, name FROM stations_offices WHERE id = ?').bind(stationId).first<any>();
    if (!target) return c.json({ error: 'Station/Office not found' }, 404);

    // Check references
    const userCount = await db.prepare('SELECT count(*) as cnt FROM users WHERE station_office_id = ?').bind(stationId).first<any>();
    if ((userCount?.cnt || 0) > 0) {
      return c.json(
        {
          error: `Cannot delete "${target.name}" because ${userCount?.cnt || 0} active personnel are stationed here. Please deactivate it instead.`,
          cannotDelete: true,
        },
        400
      );
    }

    await db.prepare('DELETE FROM stations_offices WHERE id = ?').bind(stationId).run();
    return c.json({ success: true, message: `Station/Office "${target.name}" deleted.` });
  });

  // -------------------------------------------------------------
  // 3. DESIGNATIONS
  // -------------------------------------------------------------

  // GET /api/masters/designations
  router.get('/designations', async (c) => {
    const user = c.get('user');
    const showAll = c.req.query('all') === 'true' && user?.role === ROLES.SUPER_ADMIN;
    const search = c.req.query('search')?.trim().toLowerCase();

    let sql = 'SELECT id, code, name, short_name as shortName, rank_order as rankOrder, is_active as isActive FROM designations';
    const conditions: string[] = [];
    const params: any[] = [];

    if (!showAll) {
      conditions.push('is_active = 1');
    }

    if (search) {
      conditions.push('(LOWER(name) LIKE ? OR LOWER(short_name) LIKE ? OR LOWER(code) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY rank_order ASC, name ASC';
    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ designations: results });
  });

  // POST /api/masters/designations (Super Admin only)
  router.post('/designations', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    try {
      const body = await c.req.json();
      const validated = CreateDesignationSchema.parse(body);

      const nameCheck = validateEnglishMasterName(validated.name);
      if (!nameCheck.valid) return c.json({ error: nameCheck.error }, 422);

      const existing = await db
        .prepare('SELECT id FROM designations WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)')
        .bind(validated.name.trim(), validated.code.trim())
        .first();

      if (existing) {
        return c.json({ error: 'A designation with this name or code already exists.' }, 409);
      }

      const desigId = `desig_${validated.code.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO designations (id, code, name, short_name, rank_order, is_active, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .bind(desigId, validated.code.trim().toUpperCase(), validated.name.trim(), validated.shortName.trim(), validated.rankOrder, now, now)
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'CREATE_DESIGNATION',
        entityType: 'DESIGNATION',
        entityId: desigId,
        afterState: { code: validated.code, name: validated.name },
      });

      return c.json({ success: true, designationId: desigId, message: `Designation ${validated.name} created.` });
    } catch (err: any) {
      if (err.errors) {
        return c.json({ error: 'Validation failed', details: err.errors }, 422);
      }
      return c.json({ error: err.message || 'Failed to create designation' }, 400);
    }
  });

  // PUT /api/masters/designations/:id (Super Admin only)
  router.put('/designations/:id', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    const desigId = c.req.param('id');
    try {
      const body = await c.req.json();
      const { name, shortName, rankOrder, code } = body;

      const target = await db.prepare('SELECT * FROM designations WHERE id = ?').bind(desigId).first<any>();
      if (!target) return c.json({ error: 'Designation not found' }, 404);

      if (name) {
        const nameCheck = validateEnglishMasterName(name);
        if (!nameCheck.valid) return c.json({ error: nameCheck.error }, 422);
      }

      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE designations 
           SET name = IFNULL(?, name),
               short_name = IFNULL(?, short_name),
               rank_order = IFNULL(?, rank_order),
               code = IFNULL(?, code),
               updated_at = ?
           WHERE id = ?`
        )
        .bind(name?.trim() || null, shortName?.trim() || null, rankOrder || null, code?.trim()?.toUpperCase() || null, now, desigId)
        .run();

      return c.json({ success: true, message: 'Designation updated successfully.' });
    } catch (err: any) {
      return c.json({ error: err.message || 'Update failed' }, 400);
    }
  });

  // POST /api/masters/designations/:id/toggle-active (Super Admin only)
  router.post('/designations/:id/toggle-active', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    const desigId = c.req.param('id');
    const target = await db.prepare('SELECT id, is_active, name FROM designations WHERE id = ?').bind(desigId).first<any>();
    if (!target) return c.json({ error: 'Designation not found' }, 404);

    const newActive = target.is_active === 1 ? 0 : 1;
    await db.prepare('UPDATE designations SET is_active = ?, updated_at = ? WHERE id = ?').bind(newActive, new Date().toISOString(), desigId).run();

    return c.json({ success: true, isActive: newActive, message: `${target.name} ${newActive ? 'activated' : 'deactivated'}.` });
  });

  // DELETE /api/masters/designations/:id (Super Admin only)
  router.delete('/designations/:id', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }
    const desigId = c.req.param('id');
    const target = await db.prepare('SELECT id, name FROM designations WHERE id = ?').bind(desigId).first<any>();
    if (!target) return c.json({ error: 'Designation not found' }, 404);

    const userCount = await db.prepare('SELECT count(*) as cnt FROM users WHERE designation_id = ?').bind(desigId).first<any>();
    if ((userCount?.cnt || 0) > 0) {
      return c.json(
        {
          error: `Cannot delete designation "${target.name}" because ${userCount?.cnt || 0} active personnel hold this rank. Please deactivate it instead.`,
          cannotDelete: true,
        },
        400
      );
    }

    await db.prepare('DELETE FROM designations WHERE id = ?').bind(desigId).run();
    return c.json({ success: true, message: `Designation "${target.name}" deleted.` });
  });

  // -------------------------------------------------------------
  // 4. BULK MASTER OPERATIONS: DRY-RUN, COMMIT & ROLLBACK
  // -------------------------------------------------------------

  // POST /api/masters/bulk/dry-run (Super Admin only)
  router.post('/bulk/dry-run', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }

    try {
      const body = await c.req.json();
      const { entityType, districtId, rawLines, rows: inputRows, skipExisting = true } = body;

      if (!['DISTRICT', 'POLICE_STATION', 'OFFICE', 'DESIGNATION'].includes(entityType)) {
        return c.json({ error: 'Invalid entityType' }, 400);
      }

      // Parse candidate items
      let itemsToProcess: Array<{
        rowIndex: number;
        rawName: string;
        code?: string;
        type?: string;
        districtNameOrId?: string;
        shortName?: string;
        rankOrder?: number;
      }> = [];

      if (rawLines && typeof rawLines === 'string') {
        const lines = rawLines.split(/\r?\n/);
        let idx = 1;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Support tab or comma separation if pasted with code
          const parts = trimmed.split(/[\t,]/).map((p) => p.trim());
          itemsToProcess.push({
            rowIndex: idx++,
            rawName: parts[0],
            code: parts[1] || undefined,
            type: entityType === 'POLICE_STATION' ? 'POLICE_STATION' : entityType === 'OFFICE' ? (parts[2] || 'SP_OFFICE') : undefined,
            districtNameOrId: districtId || parts[2] || undefined,
            shortName: entityType === 'DESIGNATION' ? (parts[1] || parts[0].slice(0, 10)) : undefined,
            rankOrder: entityType === 'DESIGNATION' && parts[2] && !isNaN(Number(parts[2])) ? Number(parts[2]) : 99,
          });
        }
      } else if (Array.isArray(inputRows)) {
        itemsToProcess = inputRows.map((r, i) => ({
          rowIndex: i + 1,
          rawName: String(r.name || r['Police Station Name'] || r['Office Name'] || r['District Name'] || r['Designation Name'] || '').trim(),
          code: String(r.code || r['Code'] || '').trim() || undefined,
          type: r.type || r['Office Type'] || (entityType === 'POLICE_STATION' ? 'POLICE_STATION' : 'SP_OFFICE'),
          districtNameOrId: r.districtId || r.districtName || r['District Name or ID'] || districtId,
          shortName: r.shortName || r['Short Name'],
          rankOrder: Number(r.rankOrder || r['Rank Order']) || 99,
        }));
      }

      // Load reference data for validation
      const allDistricts = await db.prepare('SELECT id, name, code FROM districts').all<any>();
      const districtsMap = new Map<string, any>();
      for (const d of allDistricts.results) {
        districtsMap.set(d.id.toLowerCase(), d);
        districtsMap.set(d.name.toLowerCase(), d);
        districtsMap.set(d.code.toLowerCase(), d);
      }

      // Existing entities for collision check
      let existingNamesSet = new Set<string>();
      if (entityType === 'DISTRICT') {
        const dRes = await db.prepare('SELECT LOWER(name) as k FROM districts').all<any>();
        dRes.results.forEach((r) => existingNamesSet.add(r.k));
      } else if (entityType === 'DESIGNATION') {
        const dRes = await db.prepare('SELECT LOWER(name) as k FROM designations').all<any>();
        dRes.results.forEach((r) => existingNamesSet.add(r.k));
      }

      const previewRows: any[] = [];
      const seenInFile = new Set<string>();

      let validCount = 0;
      let alreadyExistsCount = 0;
      let duplicateInFileCount = 0;
      let invalidCount = 0;
      let unknownDistrictCount = 0;

      for (const item of itemsToProcess) {
        const nameVal = item.rawName.trim();
        const canonicalName = nameVal.replace(/\s+/g, ' ');

        // 1. English-only name check
        const nameCheck = validateEnglishMasterName(canonicalName);
        if (!nameCheck.valid) {
          invalidCount++;
          previewRows.push({
            rowIndex: item.rowIndex,
            submittedValue: nameVal,
            canonicalValue: canonicalName,
            status: 'INVALID',
            error: nameCheck.error,
          });
          continue;
        }

        // 2. District resolution for stations/offices
        let resolvedDistrict: any = null;
        if (entityType === 'POLICE_STATION' || entityType === 'OFFICE') {
          const distKey = String(item.districtNameOrId || districtId || '').trim().toLowerCase();
          resolvedDistrict = districtsMap.get(distKey);
          if (!resolvedDistrict) {
            unknownDistrictCount++;
            previewRows.push({
              rowIndex: item.rowIndex,
              submittedValue: nameVal,
              canonicalValue: canonicalName,
              districtName: item.districtNameOrId || 'MISSING',
              status: 'UNKNOWN_DISTRICT',
              error: `District "${item.districtNameOrId || 'None'}" not recognized.`,
            });
            continue;
          }
        }

        // 3. Collision key
        const collisionKey = resolvedDistrict
          ? `${resolvedDistrict.id}:${canonicalName.toLowerCase()}`
          : canonicalName.toLowerCase();

        // Check duplicate in this file/batch
        if (seenInFile.has(collisionKey)) {
          duplicateInFileCount++;
          previewRows.push({
            rowIndex: item.rowIndex,
            submittedValue: nameVal,
            canonicalValue: canonicalName,
            districtName: resolvedDistrict?.name,
            status: 'DUPLICATE_IN_FILE',
            error: 'Duplicate item in this submission batch.',
          });
          continue;
        }
        seenInFile.add(collisionKey);

        // Check already exists in DB
        let alreadyInDb = false;
        if (resolvedDistrict) {
          const ex = await db
            .prepare('SELECT id FROM stations_offices WHERE district_id = ? AND LOWER(name) = LOWER(?)')
            .bind(resolvedDistrict.id, canonicalName)
            .first();
          if (ex) alreadyInDb = true;
        } else {
          if (existingNamesSet.has(canonicalName.toLowerCase())) {
            alreadyInDb = true;
          }
        }

        if (alreadyInDb) {
          alreadyExistsCount++;
          previewRows.push({
            rowIndex: item.rowIndex,
            submittedValue: nameVal,
            canonicalValue: canonicalName,
            districtId: resolvedDistrict?.id,
            districtName: resolvedDistrict?.name,
            status: 'ALREADY_EXISTS',
            error: skipExisting ? 'Skipped (Already exists in database)' : 'Record already exists',
          });
          continue;
        }

        // Record is valid and ready
        validCount++;
        previewRows.push({
          rowIndex: item.rowIndex,
          submittedValue: nameVal,
          canonicalValue: canonicalName,
          code: item.code || undefined,
          districtId: resolvedDistrict?.id,
          districtName: resolvedDistrict?.name,
          type: item.type || (entityType === 'POLICE_STATION' ? 'POLICE_STATION' : 'SP_OFFICE'),
          shortName: item.shortName || canonicalName.slice(0, 10),
          rankOrder: item.rankOrder || 99,
          status: 'VALID',
        });
      }

      return c.json({
        success: true,
        summary: {
          totalRows: itemsToProcess.length,
          validCount,
          alreadyExistsCount,
          duplicateInFileCount,
          invalidCount,
          unknownDistrictCount,
        },
        previewRows,
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Dry-run failed' }, 400);
    }
  });

  // POST /api/masters/bulk/commit (Super Admin only)
  router.post('/bulk/commit', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }

    try {
      const body = await c.req.json();
      const { entityType, rows, fileName, districtId } = body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return c.json({ error: 'No rows provided to commit.' }, 400);
      }

      const jobId = `job_master_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      // Insert job row first so snapshot child foreign key (import_rollback_snapshots.job_id) is satisfied
      await db
        .prepare(
          `INSERT INTO excel_import_jobs 
           (id, admin_id, district_id, file_name, status, total_rows, created_count, updated_count, rejected_count, created_at, committed_at)
           VALUES (?, ?, ?, ?, 'COMMITTED', ?, 0, 0, ?, ?, ?)`
        )
        .bind(
          jobId,
          user.id,
          districtId || null,
          fileName || `Master Bulk Import: ${entityType}`,
          rows.length,
          rows.length,
          now,
          now
        )
        .run();

      let createdCount = 0;

      for (const row of rows) {
        if (row.status && row.status !== 'VALID') continue;

        const name = String(row.canonicalValue || row.name).trim();
        if (!name) continue;

        if (entityType === 'DISTRICT') {
          const randSuffix = crypto.randomUUID().slice(0, 4).toUpperCase();
          const code = row.code
            ? String(row.code).toUpperCase().replace(/[^A-Z0-9_]/g, '_')
            : (name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() + '_' + randSuffix);
          const id = `dist_${code.toLowerCase()}`;
          await db
            .prepare(
              `INSERT OR IGNORE INTO districts (id, code, name, zone, range, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
            )
            .bind(id, code, name, row.zone || null, row.range || null, now, now)
            .run();

          // Snapshot for rollback
          await db
            .prepare(
              `INSERT INTO import_rollback_snapshots (id, job_id, entity_type, entity_id, previous_state_json, created_at)
               VALUES (?, ?, 'DISTRICT', ?, NULL, ?)`
            )
            .bind(`snap_${crypto.randomUUID()}`, jobId, id, now)
            .run();

          createdCount++;
        } else if (entityType === 'POLICE_STATION' || entityType === 'OFFICE') {
          const targetDistrictId = row.districtId || districtId;
          if (!targetDistrictId) continue;

          const type = row.type || (entityType === 'POLICE_STATION' ? 'POLICE_STATION' : 'SP_OFFICE');
          const id = `stn_${crypto.randomUUID()}`;

          await db
            .prepare(
              `INSERT OR IGNORE INTO stations_offices (id, district_id, name, type, address, phone, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
            )
            .bind(id, targetDistrictId, name, type, row.address || null, row.phone || null, now, now)
            .run();

          await db
            .prepare(
              `INSERT INTO import_rollback_snapshots (id, job_id, entity_type, entity_id, previous_state_json, created_at)
               VALUES (?, ?, ?, ?, NULL, ?)`
            )
            .bind(`snap_${crypto.randomUUID()}`, jobId, entityType, id, now)
            .run();

          createdCount++;
        } else if (entityType === 'DESIGNATION') {
          const randSuffix = crypto.randomUUID().slice(0, 4).toUpperCase();
          const code = row.code
            ? String(row.code).toUpperCase().replace(/[^A-Z0-9_]/g, '_')
            : (name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() + '_' + randSuffix);
          const id = `desig_${code.toLowerCase()}`;
          const shortName = row.shortName || name.slice(0, 10);
          const rankOrder = Number(row.rankOrder) || 99;

          await db
            .prepare(
              `INSERT OR IGNORE INTO designations (id, code, name, short_name, rank_order, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
            )
            .bind(id, code, name, shortName, rankOrder, now, now)
            .run();

          await db
            .prepare(
              `INSERT INTO import_rollback_snapshots (id, job_id, entity_type, entity_id, previous_state_json, created_at)
               VALUES (?, ?, 'DESIGNATION', ?, NULL, ?)`
            )
            .bind(`snap_${crypto.randomUUID()}`, jobId, id, now)
            .run();

          createdCount++;
        }
      }

      // Update final counts in excel_import_jobs
      await db
        .prepare(
          `UPDATE excel_import_jobs 
           SET created_count = ?, rejected_count = ?, committed_at = ?
           WHERE id = ?`
        )
        .bind(
          createdCount,
          rows.length - createdCount,
          now,
          jobId
        )
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'BULK_MASTER_IMPORT',
        entityType: 'MASTER_DATA',
        entityId: jobId,
        afterState: { entityType, createdCount, totalRows: rows.length },
      });

      return c.json({
        success: true,
        jobId,
        createdCount,
        skippedCount: rows.length - createdCount,
        message: `Successfully imported ${createdCount} ${entityType} record(s).`,
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Commit failed' }, 400);
    }
  });

  // POST /api/masters/bulk/rollback (Super Admin only)
  router.post('/bulk/rollback', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }

    try {
      const { jobId } = await c.req.json();
      if (!jobId) return c.json({ error: 'jobId is required' }, 400);

      const job = await db.prepare('SELECT * FROM excel_import_jobs WHERE id = ?').bind(jobId).first<any>();
      if (!job) return c.json({ error: 'Import job not found' }, 404);

      if (job.status === 'ROLLED_BACK') {
        return c.json({ error: 'This import job has already been rolled back.' }, 400);
      }

      const snapshots = await db
        .prepare('SELECT * FROM import_rollback_snapshots WHERE job_id = ?')
        .bind(jobId)
        .all<any>();

      let rolledBackCount = 0;
      let protectedCount = 0;

      for (const snap of snapshots.results) {
        const { entity_type, entity_id } = snap;

        // Protection check
        let isReferenced = false;
        if (entity_type === 'DISTRICT') {
          const stnCnt = await db.prepare('SELECT count(*) as c FROM stations_offices WHERE district_id = ?').bind(entity_id).first<any>();
          const usrCnt = await db.prepare('SELECT count(*) as c FROM users WHERE district_id = ?').bind(entity_id).first<any>();
          if ((stnCnt?.c || 0) > 0 || (usrCnt?.c || 0) > 0) isReferenced = true;
        } else if (entity_type === 'POLICE_STATION' || entity_type === 'OFFICE') {
          const usrCnt = await db.prepare('SELECT count(*) as c FROM users WHERE station_office_id = ?').bind(entity_id).first<any>();
          if ((usrCnt?.c || 0) > 0) isReferenced = true;
        } else if (entity_type === 'DESIGNATION') {
          const usrCnt = await db.prepare('SELECT count(*) as c FROM users WHERE designation_id = ?').bind(entity_id).first<any>();
          if ((usrCnt?.c || 0) > 0) isReferenced = true;
        }

        if (isReferenced) {
          protectedCount++;
        } else {
          // Safe to delete newly created record
          if (entity_type === 'DISTRICT') {
            await db.prepare('DELETE FROM districts WHERE id = ?').bind(entity_id).run();
          } else if (entity_type === 'POLICE_STATION' || entity_type === 'OFFICE') {
            await db.prepare('DELETE FROM stations_offices WHERE id = ?').bind(entity_id).run();
          } else if (entity_type === 'DESIGNATION') {
            await db.prepare('DELETE FROM designations WHERE id = ?').bind(entity_id).run();
          }
          rolledBackCount++;
        }
      }

      await db.prepare("UPDATE excel_import_jobs SET status = 'ROLLED_BACK' WHERE id = ?").bind(jobId).run();

      await logAuditEvent(db, {
        actor: user,
        action: 'BULK_MASTER_ROLLBACK',
        entityType: 'MASTER_DATA',
        entityId: jobId,
        afterState: { rolledBackCount, protectedCount },
      });

      return c.json({
        success: true,
        rolledBackCount,
        protectedCount,
        message: `Rollback completed: ${rolledBackCount} record(s) safely removed, ${protectedCount} record(s) protected from deletion due to active references.`,
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Rollback failed' }, 400);
    }
  });

  // GET /api/masters/bulk/history (Super Admin only)
  router.get('/bulk/history', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }

    const { results } = await db
      .prepare(
        `SELECT j.*, u.full_name as adminName, d.name as districtName
         FROM excel_import_jobs j
         LEFT JOIN users u ON j.admin_id = u.id
         LEFT JOIN districts d ON j.district_id = d.id
         WHERE j.file_name LIKE 'Master%' OR j.file_name LIKE 'Bulk%'
         ORDER BY j.created_at DESC LIMIT 50`
      )
      .all();

    return c.json({ history: results });
  });

  // -------------------------------------------------------------
  // 5. VERSIONED POLICIES
  // -------------------------------------------------------------

  // GET /api/masters/policies
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
