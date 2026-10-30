import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from '../services/auth';
import { logAuditEvent } from '../services/audit';
import { ROLES } from '@police-directory/shared';

export function createDiariesRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // GET /api/diaries - List & Search Contact Diaries (All authenticated active users)
  router.get('/', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (user.status !== 'ACTIVE') {
      return c.json({ error: 'Access restricted to approved active personnel.' }, 403);
    }

    const category = c.req.query('category');
    const districtId = c.req.query('districtId');
    const q = (c.req.query('q') || '').trim();

    let sql = `
      SELECT cd.id, cd.title, cd.description, cd.category,
             cd.district_id as districtId, d.name as districtName,
             cd.source_date as sourceDate, cd.file_type as fileType,
             cd.external_url as externalUrl, cd.file_name as fileName,
             cd.file_size as fileSize, cd.mime_type as mimeType,
             cd.download_count as downloadCount, cd.created_at as createdAt,
             u.full_name as uploaderName
      FROM contact_diaries cd
      LEFT JOIN districts d ON cd.district_id = d.id
      JOIN users u ON cd.uploaded_by = u.id
      WHERE cd.is_published = 1
    `;
    const params: any[] = [];

    if (category) {
      sql += ' AND cd.category = ?';
      params.push(category);
    }

    if (districtId) {
      sql += ' AND cd.district_id = ?';
      params.push(districtId);
    }

    if (q) {
      sql += ' AND (cd.title LIKE ? OR cd.description LIKE ? OR d.name LIKE ?)';
      const wildcard = `%${q}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    sql += ' ORDER BY cd.created_at DESC';
    const { results } = await db.prepare(sql).bind(...params).all();

    return c.json({ success: true, diaries: results });
  });

  // GET /api/diaries/:id/download - Secure download or redirect (All authenticated active users)
  router.get('/:id/download', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (user.status !== 'ACTIVE') {
      return c.json({ error: 'Access restricted to approved active personnel.' }, 403);
    }

    const id = c.req.param('id');
    const diary = await db
      .prepare('SELECT * FROM contact_diaries WHERE id = ? AND is_published = 1')
      .bind(id)
      .first<any>();

    if (!diary) {
      return c.json({ error: 'Contact diary not found.' }, 404);
    }

    // Increment download count
    await db
      .prepare('UPDATE contact_diaries SET download_count = download_count + 1 WHERE id = ?')
      .bind(id)
      .run();

    await logAuditEvent(db, {
      actor: user,
      action: 'DOWNLOAD_CONTACT_DIARY',
      entityType: 'DIARY',
      entityId: id,
      afterState: { fileType: diary.file_type, fileName: diary.file_name },
    });

    if (diary.file_type === 'URL') {
      // Validate secure HTTPS protocol
      if (!diary.external_url?.startsWith('https://')) {
        return c.json({ error: 'Insecure URL scheme rejected.' }, 400);
      }
      return c.json({ success: true, url: diary.external_url });
    }

    // Binary file download
    if (!diary.file_data) {
      return c.json({ error: 'File content unavailable.' }, 404);
    }

    const buffer = Buffer.from(diary.file_data, 'base64');
    const filename = diary.file_name || `diary_${diary.id}.pdf`;
    const mime = diary.mime_type || 'application/octet-stream';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'private, no-cache',
      },
    });
  });

  // POST /api/diaries - Super Admin uploads or registers a contact diary (V4.5)
  router.post('/', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }

    try {
      const body = await c.req.json();
      const title = String(body.title || '').trim();
      const description = body.description ? String(body.description).trim() : null;
      const category = String(body.category || 'GENERAL').trim().toUpperCase();
      const districtId = body.districtId ? String(body.districtId).trim() : null;
      const sourceDate = String(body.sourceDate || new Date().toISOString().slice(0, 10)).trim();
      const fileType = String(body.fileType || 'PDF').trim().toUpperCase();

      if (!title || title.length < 3) {
        return c.json({ error: 'Title is required (minimum 3 characters).' }, 422);
      }

      if (!['URL', 'PDF', 'XLSX', 'XLS', 'CSV'].includes(fileType)) {
        return c.json({ error: 'Invalid file type. Allowed: URL, PDF, XLSX, XLS, CSV.' }, 422);
      }

      let externalUrl: string | null = null;
      let fileName: string | null = null;
      let fileData: string | null = null;
      let fileSize: number | null = null;
      let mimeType: string | null = null;

      if (fileType === 'URL') {
        externalUrl = String(body.externalUrl || '').trim();
        if (!/^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(externalUrl)) {
          return c.json({ error: 'External URL must be a valid HTTPS web address.' }, 422);
        }
      } else {
        fileName = String(body.fileName || `diary_${Date.now()}.${fileType.toLowerCase()}`).trim();
        fileData = body.fileData || null; // base64 string
        fileSize = Number(body.fileSize) || (fileData ? Math.round((fileData.length * 3) / 4) : 0);
        mimeType =
          body.mimeType ||
          (fileType === 'PDF'
            ? 'application/pdf'
            : fileType === 'XLSX'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : fileType === 'XLS'
            ? 'application/vnd.ms-excel'
            : 'text/csv');

        if (!fileData) {
          return c.json({ error: 'File data is required for document uploads.' }, 422);
        }

        // Limit file size to 25MB
        if (fileSize > 25 * 1024 * 1024) {
          return c.json({ error: 'File size exceeds maximum permitted limit (25 MB).' }, 422);
        }
      }

      const id = `diary_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO contact_diaries 
           (id, title, description, category, district_id, source_date, file_type, external_url,
            file_name, file_size, file_data, mime_type, uploaded_by, is_published, download_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
        )
        .bind(
          id,
          title,
          description,
          category,
          districtId,
          sourceDate,
          fileType,
          externalUrl,
          fileName,
          fileSize,
          fileData,
          mimeType,
          user.id,
          now,
          now
        )
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'CREATE_CONTACT_DIARY',
        entityType: 'DIARY',
        entityId: id,
        afterState: { title, fileType, category, districtId },
      });

      return c.json({
        success: true,
        diaryId: id,
        message: 'Contact diary published successfully.',
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to create contact diary' }, 400);
    }
  });

  // DELETE /api/diaries/:id (Super Admin only)
  router.delete('/:id', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Super Admin only' }, 403);
    }

    const id = c.req.param('id');
    const existing = await db
      .prepare('SELECT id, title FROM contact_diaries WHERE id = ?')
      .bind(id)
      .first<any>();

    if (!existing) {
      return c.json({ error: 'Diary entry not found.' }, 404);
    }

    await db.prepare('DELETE FROM contact_diaries WHERE id = ?').bind(id).run();

    await logAuditEvent(db, {
      actor: user,
      action: 'DELETE_CONTACT_DIARY',
      entityType: 'DIARY',
      entityId: id,
      beforeState: { title: existing.title },
    });

    return c.json({ success: true, message: 'Contact diary deleted successfully.' });
  });

  return router;
}
