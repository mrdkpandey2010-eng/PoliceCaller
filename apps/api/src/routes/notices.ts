import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from '../services/auth';
import { logAuditEvent } from '../services/audit';
import { RBAC, ROLES } from '@police-directory/shared';

export function createNoticesRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // GET /api/notices - List notices accessible to the user
  router.get('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    let sql = `
      SELECT 
        n.*,
        u.full_name as publisherName,
        des.short_name as publisherRank,
        d.name as targetDistrictName,
        nr.read_at as readAt,
        nr.acknowledged_at as acknowledgedAt,
        CASE WHEN nr.read_at IS NOT NULL THEN 1 ELSE 0 END as isRead,
        CASE WHEN nr.acknowledged_at IS NOT NULL THEN 1 ELSE 0 END as isAcknowledged
      FROM notices n
      JOIN users u ON n.published_by = u.id
      JOIN designations des ON u.designation_id = des.id
      LEFT JOIN districts d ON n.target_district_id = d.id
      LEFT JOIN notice_recipients nr ON (nr.notice_id = n.id AND nr.user_id = ?)
      WHERE n.is_published = 1
    `;

    const params: any[] = [user.id];

    if (user.role === ROLES.SUPER_ADMIN) {
      // Super Admin sees all notices
    } else if (user.role === ROLES.DISTRICT_CO_ADMIN) {
      sql += ` AND (n.target_scope = 'STATEWIDE' OR n.target_scope = 'CO_ADMINS' OR (n.target_scope = 'DISTRICT' AND n.target_district_id = ?))`;
      params.push(user.districtId);
    } else {
      sql += ` AND (n.target_scope = 'STATEWIDE' OR (n.target_scope = 'DISTRICT' AND n.target_district_id = ?))`;
      params.push(user.districtId);
    }

    sql += ` ORDER BY n.created_at DESC LIMIT 100`;

    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ success: true, notices: results });
  });

  // POST /api/notices - Publish departmental order / notice
  router.post('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const body = await c.req.json();
      const { title, body: content, urgency = 'NORMAL', targetScope = 'STATEWIDE', targetDistrictId } = body;

      if (!title || !content) {
        return c.json({ error: 'Title and body are required.' }, 400);
      }

      // RBAC check
      const canPublish = RBAC.canPublishNotice(user, targetScope, targetDistrictId);
      if (!canPublish) {
        return c.json(
          {
            error:
              'Forbidden: District Co-Admins may publish orders to their assigned district only. Super Admin privileges required for statewide scope.',
          },
          403
        );
      }

      const noticeId = `not_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO notices 
           (id, title, body, urgency, target_scope, target_district_id, is_published, published_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
        )
        .bind(
          noticeId,
          title.trim(),
          content.trim(),
          urgency,
          targetScope,
          targetDistrictId || null,
          user.id,
          now,
          now
        )
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'PUBLISH_NOTICE',
        entityType: 'NOTICE',
        entityId: noticeId,
        districtScope: targetDistrictId || 'STATEWIDE',
        afterState: { title, urgency, targetScope },
      });

      return c.json({
        success: true,
        message: 'Departmental notice published successfully.',
        noticeId,
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to publish notice' }, 400);
    }
  });

  // POST /api/notices/:noticeId/read - Record first-read timestamp
  router.post('/:noticeId/read', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const noticeId = c.req.param('noticeId');
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO notice_recipients (id, notice_id, user_id, read_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(notice_id, user_id) DO UPDATE SET read_at = IFNULL(notice_recipients.read_at, excluded.read_at)`
      )
      .bind(`nr_${crypto.randomUUID()}`, noticeId, user.id, now)
      .run();

    return c.json({ success: true, readAt: now });
  });

  // POST /api/notices/:noticeId/acknowledge - Formal departmental acknowledgment
  router.post('/:noticeId/acknowledge', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const noticeId = c.req.param('noticeId');
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO notice_recipients (id, notice_id, user_id, read_at, acknowledged_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(notice_id, user_id) DO UPDATE SET 
           read_at = IFNULL(notice_recipients.read_at, excluded.read_at),
           acknowledged_at = excluded.acknowledged_at`
      )
      .bind(`nr_${crypto.randomUUID()}`, noticeId, user.id, now, now)
      .run();

    return c.json({ success: true, acknowledgedAt: now });
  });

  // GET /api/notices/:noticeId/report - Read/Acknowledged statistics report
  router.get('/:noticeId/report', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (user.role === ROLES.USER) {
      return c.json({ error: 'Forbidden: Only administrators may view notice read reports.' }, 403);
    }

    const noticeId = c.req.param('noticeId');

    const notice = await db
      .prepare('SELECT * FROM notices WHERE id = ?')
      .bind(noticeId)
      .first<any>();

    if (!notice) {
      return c.json({ error: 'Notice not found.' }, 404);
    }

    // Co-Admin can only view reports for notices relevant to their district
    if (user.role === ROLES.DISTRICT_CO_ADMIN && notice.target_district_id && notice.target_district_id !== user.districtId) {
      return c.json({ error: 'Forbidden: Notice is outside your assigned district.' }, 403);
    }

    let recipientsSql = `
      SELECT 
        nr.read_at as readAt,
        nr.acknowledged_at as acknowledgedAt,
        u.full_name as userName,
        u.pno as userPno,
        des.short_name as userRank,
        d.name as userDistrict
      FROM notice_recipients nr
      JOIN users u ON nr.user_id = u.id
      JOIN designations des ON u.designation_id = des.id
      JOIN districts d ON u.district_id = d.id
      WHERE nr.notice_id = ?
    `;
    const params: any[] = [noticeId];

    if (user.role === ROLES.DISTRICT_CO_ADMIN) {
      recipientsSql += ` AND u.district_id = ?`;
      params.push(user.districtId);
    }

    const { results } = await db.prepare(recipientsSql).bind(...params).all();

    const readCount = results.filter((r: any) => r.readAt).length;
    const ackCount = results.filter((r: any) => r.acknowledgedAt).length;

    return c.json({
      success: true,
      report: {
        noticeId,
        title: notice.title,
        totalRead: readCount,
        totalAcknowledged: ackCount,
        recipients: results,
      },
    });
  });

  return router;
}
