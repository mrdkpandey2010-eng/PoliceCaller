import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from '../services/auth';

export function createDirectoryRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // GET /api/directory - Search & Filter Contacts
  router.get('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (user.status !== 'ACTIVE') {
      return c.json({ error: 'Directory access restricted to approved active personnel.' }, 403);
    }

    const q = (c.req.query('q') || '').trim();
    const districtId = c.req.query('districtId');
    const stationId = c.req.query('stationId');
    const designationId = c.req.query('designationId');
    const favoritesOnly = c.req.query('favorites') === 'true';
    const limit = Math.min(Number(c.req.query('limit')) || 50, 50); // V4.7: exactly max 50 records per page
    const page = Math.max(Number(c.req.query('page')) || 1, 1);
    const offset = c.req.query('offset') ? Number(c.req.query('offset')) : (page - 1) * limit;

    // Track search query in recent_searches if provided
    if (q && q.length >= 2) {
      await db
        .prepare(`INSERT INTO recent_searches (id, user_id, query) VALUES (?, ?, ?)`)
        .bind(`rs_${crypto.randomUUID()}`, user.id, q)
        .run();
    }

    let sql = `
      SELECT 
        u.id, u.pno, u.full_name as fullName, u.mobile, u.whatsapp, u.email, u.photo_url as photoUrl,
        u.district_id as districtId, d.name as districtName,
        u.station_office_id as stationOfficeId, s.name as stationOfficeName,
        u.designation_id as designationId, des.name as designationName, des.short_name as designationShort,
        des.rank_order as rankOrder,
        CASE WHEN fav.id IS NOT NULL THEN 1 ELSE 0 END as isFavorite
      FROM users u
      JOIN districts d ON u.district_id = d.id
      JOIN stations_offices s ON u.station_office_id = s.id
      JOIN designations des ON u.designation_id = des.id
      LEFT JOIN favorites fav ON (fav.user_id = ? AND fav.target_user_id = u.id)
      WHERE u.status = 'ACTIVE'
    `;

    const params: any[] = [user.id];

    if (favoritesOnly) {
      sql += ` AND fav.id IS NOT NULL`;
    }

    if (districtId) {
      sql += ` AND u.district_id = ?`;
      params.push(districtId);
    }

    if (stationId) {
      sql += ` AND u.station_office_id = ?`;
      params.push(stationId);
    }

    if (designationId) {
      sql += ` AND u.designation_id = ?`;
      params.push(designationId);
    }

    if (q) {
      sql += ` AND (
        u.full_name LIKE ? OR
        u.pno LIKE ? OR
        u.mobile LIKE ? OR
        d.name LIKE ? OR
        s.name LIKE ? OR
        des.name LIKE ? OR
        des.short_name LIKE ?
      )`;
      const searchWildcard = `%${q}%`;
      params.push(
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard
      );
    }

    const { results: countRes } = await db.prepare(sql.replace(/SELECT\s+u\.id[\s\S]+?FROM/, 'SELECT count(*) as total FROM')).bind(...params).all<any>();
    const totalCount = countRes?.[0]?.total || 0;

    // Default sorting: Prioritize user's assigned station/office first, then rank order, then name
    sql += `
      ORDER BY 
        CASE WHEN u.station_office_id = ? THEN 0 ELSE 1 END,
        des.rank_order ASC,
        u.full_name ASC
      LIMIT ? OFFSET ?
    `;
    params.push(user.stationOfficeId, limit, offset);

    const { results } = await db.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      contacts: results,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      pagination: {
        page,
        limit,
        offset,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
        count: results.length,
      },
    });
  });

  // POST /api/directory/favorites/:targetUserId/toggle
  router.post('/favorites/:targetUserId/toggle', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const targetUserId = c.req.param('targetUserId');

    const existing = await db
      .prepare('SELECT id FROM favorites WHERE user_id = ? AND target_user_id = ?')
      .bind(user.id, targetUserId)
      .first();

    if (existing) {
      await db
        .prepare('DELETE FROM favorites WHERE user_id = ? AND target_user_id = ?')
        .bind(user.id, targetUserId)
        .run();
      return c.json({ success: true, isFavorite: false });
    } else {
      await db
        .prepare('INSERT INTO favorites (id, user_id, target_user_id) VALUES (?, ?, ?)')
        .bind(`fav_${crypto.randomUUID()}`, user.id, targetUserId)
        .run();
      return c.json({ success: true, isFavorite: true });
    }
  });

  // GET /api/directory/recent-searches
  router.get('/recent-searches', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { results } = await db
      .prepare(
        `SELECT DISTINCT query FROM recent_searches WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
      )
      .bind(user.id)
      .all();

    return c.json({ recentSearches: results.map((r: any) => r.query) });
  });

  // DELETE /api/directory/recent-searches
  router.delete('/recent-searches', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    await db.prepare('DELETE FROM recent_searches WHERE user_id = ?').bind(user.id).run();
    return c.json({ success: true, message: 'Search history cleared.' });
  });

  // GET /api/directory/co-admins (V4.4: Search District Co-Admins for all approved authenticated users)
  router.get('/co-admins', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (user.status !== 'ACTIVE') {
      return c.json({ error: 'Directory access restricted to approved active personnel.' }, 403);
    }

    const q = (c.req.query('q') || '').trim();
    const districtId = c.req.query('districtId');

    let sql = `
      SELECT u.id, u.pno, u.full_name as fullName, u.mobile, u.email,
             u.district_id as districtId, d.name as districtName,
             des.name as designationName, des.short_name as designationShort,
             s.name as stationOfficeName
      FROM users u
      JOIN districts d ON u.district_id = d.id
      LEFT JOIN designations des ON u.designation_id = des.id
      LEFT JOIN stations_offices s ON u.station_office_id = s.id
      WHERE u.role = 'DISTRICT_CO_ADMIN' AND u.status = 'ACTIVE'
    `;
    const params: any[] = [];

    if (districtId) {
      sql += ' AND u.district_id = ?';
      params.push(districtId);
    }

    if (q) {
      sql += ' AND (u.full_name LIKE ? OR u.pno LIKE ? OR u.mobile LIKE ? OR d.name LIKE ?)';
      const wildcard = `%${q}%`;
      params.push(wildcard, wildcard, wildcard, wildcard);
    }

    sql += ' ORDER BY d.name ASC, u.full_name ASC';
    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ success: true, coAdmins: results });
  });

  // GET /api/directory/stations-offices (V4.4: Search police stations and offices with real contact numbers)
  router.get('/stations-offices', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (user.status !== 'ACTIVE') {
      return c.json({ error: 'Directory access restricted to approved active personnel.' }, 403);
    }

    const districtId = c.req.query('districtId');
    const type = c.req.query('type'); // 'POLICE_STATION' | 'OFFICE' | undefined
    const q = (c.req.query('q') || '').trim();

    let sql = `
      SELECT s.id, s.name, s.type, s.address, s.phone, s.district_id as districtId,
             d.name as districtName
      FROM stations_offices s
      JOIN districts d ON s.district_id = d.id
      WHERE s.is_active = 1
    `;
    const params: any[] = [];

    if (districtId) {
      sql += ' AND s.district_id = ?';
      params.push(districtId);
    }

    if (type === 'POLICE_STATION') {
      sql += " AND s.type = 'POLICE_STATION'";
    } else if (type === 'OFFICE') {
      sql += " AND s.type != 'POLICE_STATION'";
    }

    if (q) {
      sql += ' AND (s.name LIKE ? OR d.name LIKE ? OR s.phone LIKE ?)';
      const wildcard = `%${q}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    sql += ' ORDER BY d.name ASC, s.name ASC';
    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ success: true, stationsOffices: results });
  });

  return router;
}
