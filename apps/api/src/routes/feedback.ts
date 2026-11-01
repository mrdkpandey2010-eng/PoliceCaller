import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from '../services/auth';
import { logAuditEvent } from '../services/audit';
import { ROLES } from '@police-directory/shared';

export function createFeedbackRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // POST /api/feedback - Submit real-time feedback
  router.post('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const body = await c.req.json();
      const { category, subject, message, rating = 5 } = body;

      const validCategories = ['SUGGESTION', 'DATA_CORRECTION', 'BUG_REPORT', 'GENERAL'];
      if (!category || !validCategories.includes(category)) {
        return c.json({ error: 'Valid feedback category is required (SUGGESTION, DATA_CORRECTION, BUG_REPORT, GENERAL).' }, 422);
      }

      if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
        return c.json({ error: 'Subject must be at least 3 characters long.' }, 422);
      }

      if (!message || typeof message !== 'string' || message.trim().length < 5) {
        return c.json({ error: 'Feedback message must be at least 5 characters long.' }, 422);
      }

      const numRating = Math.min(Math.max(Number(rating) || 5, 1), 5);
      const feedbackId = `fb_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO feedbacks (id, user_id, category, subject, message, rating, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`
        )
        .bind(
          feedbackId,
          user.id,
          category,
          subject.trim(),
          message.trim(),
          numRating,
          now,
          now
        )
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'SUBMIT_FEEDBACK',
        entityType: 'FEEDBACK',
        entityId: feedbackId,
        districtScope: user.districtId,
        afterState: { category, subject: subject.trim(), rating: numRating },
      });

      return c.json({
        success: true,
        message: 'Feedback submitted successfully. Thank you for your real-time input.',
        feedbackId,
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to submit feedback' }, 400);
    }
  });

  // GET /api/feedback - List feedbacks (Super Admin: statewide, Co-Admin: district scoped, User: own feedbacks)
  router.get('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const statusFilter = c.req.query('status');
    const categoryFilter = c.req.query('category');

    let sql = `
      SELECT 
        fb.id, fb.category, fb.subject, fb.message, fb.rating, fb.status,
        fb.admin_notes as adminNotes, fb.resolved_at as resolvedAt, fb.created_at as createdAt,
        u.id as userId, u.pno as userPno, u.full_name as userName, u.mobile as userMobile,
        d.id as districtId, d.name as districtName,
        s.name as stationOfficeName,
        des.name as designationName, des.short_name as designationShort,
        resolver.full_name as resolvedByName
      FROM feedbacks fb
      JOIN users u ON fb.user_id = u.id
      JOIN districts d ON u.district_id = d.id
      JOIN stations_offices s ON u.station_office_id = s.id
      JOIN designations des ON u.designation_id = des.id
      LEFT JOIN users resolver ON fb.resolved_by = resolver.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (user.role === ROLES.SUPER_ADMIN) {
      // Super Admin sees all feedbacks statewide
    } else if (user.role === ROLES.DISTRICT_CO_ADMIN) {
      // Co-Admin sees feedbacks submitted by users within their district
      sql += ' AND u.district_id = ?';
      params.push(user.districtId);
    } else {
      // Regular user sees only their own feedbacks
      sql += ' AND fb.user_id = ?';
      params.push(user.id);
    }

    if (statusFilter) {
      sql += ' AND fb.status = ?';
      params.push(statusFilter);
    }

    if (categoryFilter) {
      sql += ' AND fb.category = ?';
      params.push(categoryFilter);
    }

    sql += ' ORDER BY fb.created_at DESC LIMIT 100';

    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ success: true, feedbacks: results });
  });

  // PATCH /api/feedback/:id/status - Update feedback review status (Admin only)
  router.patch('/:id/status', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.DISTRICT_CO_ADMIN) {
      return c.json({ error: 'Forbidden: Admin authority required to resolve feedback.' }, 403);
    }

    const feedbackId = c.req.param('id');
    const body = await c.req.json();
    const { status, adminNotes } = body;

    const validStatuses = ['PENDING', 'REVIEWED', 'RESOLVED'];
    if (!status || !validStatuses.includes(status)) {
      return c.json({ error: 'Valid status required (PENDING, REVIEWED, RESOLVED).' }, 422);
    }

    // Verify feedback exists and check district scope for Co-Admin
    const target = await db
      .prepare(
        `SELECT fb.id, fb.status, u.district_id
         FROM feedbacks fb
         JOIN users u ON fb.user_id = u.id
         WHERE fb.id = ?`
      )
      .bind(feedbackId)
      .first<any>();

    if (!target) {
      return c.json({ error: 'Feedback record not found.' }, 404);
    }

    if (user.role === ROLES.DISTRICT_CO_ADMIN && target.district_id !== user.districtId) {
      return c.json({ error: 'Forbidden: You may only resolve feedbacks within your assigned district.' }, 403);
    }

    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE feedbacks 
         SET status = ?, 
             admin_notes = IFNULL(?, admin_notes),
             resolved_by = ?,
             resolved_at = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(status, adminNotes?.trim() || null, user.id, now, now, feedbackId)
      .run();

    await logAuditEvent(db, {
      actor: user,
      action: 'RESOLVE_FEEDBACK',
      entityType: 'FEEDBACK',
      entityId: feedbackId,
      districtScope: target.district_id,
      beforeState: { status: target.status },
      afterState: { status, adminNotes, resolvedBy: user.id },
    });

    return c.json({
      success: true,
      message: `Feedback status marked as ${status}.`,
      status,
    });
  });

  return router;
}
