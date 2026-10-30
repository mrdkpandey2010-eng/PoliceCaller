import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser, hashPassword, revokeAllUserSessions } from '../services/auth';
import { logAuditEvent } from '../services/audit';
import { executeBackup, getLatestBackupStatus, restoreFromBackup } from '../services/backup';
import { RBAC, ROLES } from '@police-directory/shared';

export function createAdminRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // Middleware: Require Super Admin or District Co-Admin
  router.use('*', async (c, next) => {
    const user = c.get('user');
    if (!user || (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.DISTRICT_CO_ADMIN)) {
      return c.json({ error: 'Access denied: Departmental administrative privileges required.' }, 403);
    }
    await next();
  });

  // GET /api/admin/metrics - Real Dashboard Overview Metrics
  router.get('/metrics', async (c) => {
    const user = c.get('user')!;

    let usersQuery = `SELECT status, count(*) as cnt FROM users`;
    const params: any[] = [];

    if (user.role === ROLES.DISTRICT_CO_ADMIN) {
      usersQuery += ` WHERE district_id = ? GROUP BY status`;
      params.push(user.districtId);
    } else {
      usersQuery += ` GROUP BY status`;
    }

    const { results: userStatusCounts } = await db.prepare(usersQuery).bind(...params).all();

    let totalUsers = 0;
    let activeUsers = 0;
    let pendingUsers = 0;
    let inactiveUsers = 0;

    for (const row of userStatusCounts as any[]) {
      totalUsers += row.cnt;
      if (row.status === 'ACTIVE') activeUsers = row.cnt;
      if (row.status === 'PENDING') pendingUsers = row.cnt;
      if (row.status === 'INACTIVE') inactiveUsers = row.cnt;
    }

    const totalDistricts = (await db.prepare('SELECT count(*) as cnt FROM districts').first<any>())?.cnt || 75;

    let pendingTransfersQuery = `SELECT count(*) as cnt FROM transfer_requests WHERE status = 'PENDING'`;
    if (user.role === ROLES.DISTRICT_CO_ADMIN) {
      pendingTransfersQuery += ` AND destination_district_id = ?`;
      var pendingTransfers = (await db.prepare(pendingTransfersQuery).bind(user.districtId).first<any>())?.cnt || 0;
    } else {
      var pendingTransfers = (await db.prepare(pendingTransfersQuery).first<any>())?.cnt || 0;
    }

    const latestBackup = await getLatestBackupStatus(db);

    return c.json({
      metrics: {
        totalUsers,
        activeUsers,
        pendingUsers,
        inactiveUsers,
        totalDistricts,
        pendingTransfers,
        latestBackup,
      },
    });
  });

  // GET /api/admin/pending-users - List registrations pending approval
  router.get('/pending-users', async (c) => {
    const user = c.get('user')!;

    let sql = `
      SELECT 
        u.id, u.pno, u.full_name as fullName, u.mobile, u.whatsapp, u.email,
        u.district_id as districtId, d.name as districtName,
        u.station_office_id as stationOfficeId, s.name as stationOfficeName,
        u.designation_id as designationId, des.name as designationName,
        u.status, u.created_at as createdAt
      FROM users u
      JOIN districts d ON u.district_id = d.id
      JOIN stations_offices s ON u.station_office_id = s.id
      JOIN designations des ON u.designation_id = des.id
      WHERE u.status = 'PENDING'
    `;

    const params: any[] = [];
    if (user.role === ROLES.DISTRICT_CO_ADMIN) {
      sql += ` AND u.district_id = ?`;
      params.push(user.districtId);
    }

    sql += ` ORDER BY u.created_at ASC`;

    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ pendingUsers: results });
  });

  // POST /api/admin/review-user - Approve or Reject User Registration
  router.post('/review-user', async (c) => {
    const user = c.get('user')!;

    try {
      const body = await c.req.json();
      const { targetUserId, action, rejectionReason } = body;

      const target = await db
        .prepare('SELECT id, pno, full_name, district_id, status FROM users WHERE id = ?')
        .bind(targetUserId)
        .first<any>();

      if (!target) {
        return c.json({ error: 'User record not found.' }, 404);
      }

      // Check RBAC district authorization
      if (!RBAC.canApproveUser(user, target.district_id)) {
        return c.json({ error: 'Forbidden: You may only approve users in your assigned district.' }, 403);
      }

      const now = new Date().toISOString();
      const newStatus = action === 'APPROVE' ? 'ACTIVE' : 'REJECTED';

      await db
        .prepare(`UPDATE users SET status = ?, updated_at = ? WHERE id = ?`)
        .bind(newStatus, now, targetUserId)
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: action === 'APPROVE' ? 'APPROVE_USER_REGISTRATION' : 'REJECT_USER_REGISTRATION',
        entityType: 'USER',
        entityId: targetUserId,
        districtScope: target.district_id,
        beforeState: { status: target.status },
        afterState: { status: newStatus, rejectionReason },
      });

      return c.json({
        success: true,
        message: `User ${target.pno} ${action.toLowerCase()}d successfully.`,
        status: newStatus,
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Review failed' }, 400);
    }
  });

  // GET /api/admin/users - User Management list
  router.get('/users', async (c) => {
    const user = c.get('user')!;
    const districtId = c.req.query('districtId');
    const q = (c.req.query('q') || '').trim();
    const status = c.req.query('status');

    let sql = `
      SELECT 
        u.id, u.pno, u.full_name as fullName, u.mobile, u.email, u.role, u.status,
        u.district_id as districtId, d.name as districtName,
        u.station_office_id as stationOfficeId, s.name as stationOfficeName,
        des.short_name as designationName, u.created_at as createdAt
      FROM users u
      JOIN districts d ON u.district_id = d.id
      JOIN stations_offices s ON u.station_office_id = s.id
      JOIN designations des ON u.designation_id = des.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.role === ROLES.DISTRICT_CO_ADMIN) {
      sql += ` AND u.district_id = ?`;
      params.push(user.districtId);
    } else if (districtId) {
      sql += ` AND u.district_id = ?`;
      params.push(districtId);
    }

    if (status) {
      sql += ` AND u.status = ?`;
      params.push(status);
    }

    if (q) {
      sql += ` AND (u.full_name LIKE ? OR u.pno LIKE ? OR u.mobile LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY u.created_at DESC LIMIT 100`;

    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ users: results });
  });

  // POST /api/admin/users/:userId/status - Activate or Deactivate user
  // When deactivated, immediately revoke all active sessions!
  router.post('/users/:userId/status', async (c) => {
    const user = c.get('user')!;
    const targetUserId = c.req.param('userId');
    const body = await c.req.json();
    const { status } = body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    const target = await db
      .prepare('SELECT id, pno, role, district_id, status FROM users WHERE id = ?')
      .bind(targetUserId)
      .first<any>();

    if (!target) return c.json({ error: 'User not found' }, 404);

    if (!RBAC.canEditUser(user, target.id, target.district_id)) {
      return c.json({ error: 'Forbidden: You cannot modify users outside your assigned district.' }, 403);
    }

    // Co-Admin cannot deactivate another Co-Admin or Super Admin
    if (user.role === ROLES.DISTRICT_CO_ADMIN && target.role !== ROLES.USER) {
      return c.json({ error: 'Forbidden: Co-Admins can only alter normal users.' }, 403);
    }

    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE users SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(status, now, targetUserId)
      .run();

    let revokedSessions = 0;
    if (status === 'INACTIVE') {
      // Immediately revoke all sessions for this user!
      revokedSessions = await revokeAllUserSessions(db, targetUserId);
    }

    await logAuditEvent(db, {
      actor: user,
      action: status === 'ACTIVE' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entityType: 'USER',
      entityId: targetUserId,
      districtScope: target.district_id,
      beforeState: { status: target.status },
      afterState: { status, revokedSessions },
    });

    return c.json({
      success: true,
      message: `User status changed to ${status}. ${revokedSessions > 0 ? `${revokedSessions} active session(s) revoked.` : ''}`,
      status,
    });
  });

  // PUT & PATCH /api/admin/users/:userId/details - Update structured user details (PNO immutable)
  const handleUpdateUserDetails = async (c: any) => {
    const user = c.get('user')!;
    const targetUserId = c.req.param('userId');
    const body = await c.req.json();
    const { fullName, mobile, designationId, whatsapp, email } = body;

    const target = await db
      .prepare('SELECT id, pno, full_name, mobile, role, district_id, status FROM users WHERE id = ?')
      .bind(targetUserId)
      .first<any>();

    if (!target) return c.json({ error: 'User not found' }, 404);

    if (!RBAC.canEditUser(user, target.id, target.district_id)) {
      return c.json({ error: 'Forbidden: You cannot modify users outside your assigned district.' }, 403);
    }

    if (fullName) {
      if (!/^[A-Za-z][A-Za-z .'-]*[A-Za-z.]$/.test(fullName)) {
        return c.json({ error: 'Name must contain English letters and valid characters only.' }, 422);
      }
    }

    if (mobile) {
      if (!/^[0-9]{10}$/.test(mobile)) {
        return c.json({ error: 'Mobile must be exactly 10 ASCII digits.' }, 422);
      }
    }

    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE users 
         SET full_name = IFNULL(?, full_name),
             mobile = IFNULL(?, mobile),
             designation_id = IFNULL(?, designation_id),
             whatsapp = IFNULL(?, whatsapp),
             email = IFNULL(?, email),
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        fullName || null,
        mobile || null,
        designationId || null,
        whatsapp || null,
        email || null,
        now,
        targetUserId
      )
      .run();

    await logAuditEvent(db, {
      actor: user,
      action: 'UPDATE_USER_DETAILS',
      entityType: 'USER',
      entityId: targetUserId,
      districtScope: target.district_id,
      beforeState: { fullName: target.full_name, mobile: target.mobile },
      afterState: { fullName, mobile, designationId },
    });

    return c.json({ success: true, message: 'User details updated successfully.' });
  };

  router.put('/users/:userId/details', handleUpdateUserDetails);
  router.patch('/users/:userId/details', handleUpdateUserDetails);

  // POST /api/admin/users/:userId/reset-password - Single-use reset token or new password
  router.post('/users/:userId/reset-password', async (c) => {
    const user = c.get('user')!;
    const targetUserId = c.req.param('userId');
    const body = await c.req.json();
    const newPassword = body.newPassword;

    const target = await db
      .prepare('SELECT id, pno, role, district_id FROM users WHERE id = ?')
      .bind(targetUserId)
      .first<any>();

    if (!target) return c.json({ error: 'User not found' }, 404);

    if (!RBAC.canResetPassword(user, target.role, target.district_id)) {
      return c.json({ error: 'Forbidden: You are not authorized to reset this user’s password.' }, 403);
    }

    const now = new Date().toISOString();

    if (newPassword) {
      if (newPassword.length < 8) {
        return c.json({ error: 'New password must be at least 8 characters.' }, 400);
      }
      const newHash = hashPassword(newPassword);
      await db
        .prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
        .bind(newHash, now, targetUserId)
        .run();

      // Revoke existing sessions so user logs in with new password
      await revokeAllUserSessions(db, targetUserId);

      await logAuditEvent(db, {
        actor: user,
        action: 'ADMIN_RESET_PASSWORD',
        entityType: 'USER',
        entityId: targetUserId,
        districtScope: target.district_id,
      });

      return c.json({ success: true, message: 'Password reset successfully. Active sessions revoked.' });
    } else {
      // Generate single-use reset token
      const resetToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await db
        .prepare(
          `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_by, is_used, expires_at)
           VALUES (?, ?, ?, ?, 0, ?)`
        )
        .bind(`prt_${crypto.randomUUID()}`, targetUserId, tokenHash, user.id, expiresAt)
        .run();

      await logAuditEvent(db, {
        actor: user,
        action: 'ISSUE_PASSWORD_RESET_TOKEN',
        entityType: 'USER',
        entityId: targetUserId,
        districtScope: target.district_id,
      });

      return c.json({
        success: true,
        resetToken,
        expiresAt,
        message: 'Single-use password reset token generated successfully.',
      });
    }
  });

  // GET /api/admin/coadmins - Manage Co-Admins (Super Admin only)
  router.get('/coadmins', async (c) => {
    const user = c.get('user')!;
    if (user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Forbidden: Super Admin only.' }, 403);
    }

    const { results } = await db
      .prepare(
        `SELECT u.id, u.pno, u.full_name as fullName, u.mobile, u.email, 
                u.district_id as districtId, d.name as districtName, u.status,
                des.name as designationName, s.name as stationName
         FROM users u
         LEFT JOIN districts d ON u.district_id = d.id
         LEFT JOIN designations des ON u.designation_id = des.id
         LEFT JOIN stations_offices s ON u.station_office_id = s.id
         WHERE u.role = 'DISTRICT_CO_ADMIN'
         ORDER BY d.name ASC, u.full_name ASC`
      )
      .all();

    return c.json({ coAdmins: results });
  });

  // POST /api/admin/coadmins/:userId/assign - Promote user to District Co-Admin
  router.post('/coadmins/:userId/assign', async (c) => {
    const user = c.get('user')!;
    if (user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Forbidden: Super Admin only.' }, 403);
    }

    const targetUserId = c.req.param('userId');
    const target = await db
      .prepare('SELECT id, pno, full_name, role, district_id FROM users WHERE id = ?')
      .bind(targetUserId)
      .first<any>();

    if (!target) {
      return c.json({ error: 'User not found.' }, 404);
    }

    if (target.role === ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Cannot modify Super Admin role.' }, 400);
    }

    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE users SET role = 'DISTRICT_CO_ADMIN', updated_at = ? WHERE id = ?`)
      .bind(now, targetUserId)
      .run();

    await logAuditEvent(db, {
      actor: user,
      action: 'ASSIGN_COADMIN_ROLE',
      entityType: 'USER',
      entityId: targetUserId,
      districtScope: target.district_id || 'STATEWIDE',
      beforeState: { role: target.role },
      afterState: { role: 'DISTRICT_CO_ADMIN' },
    });

    return c.json({ success: true, message: `${target.full_name} (${target.pno}) has been appointed as District Co-Admin.` });
  });

  // POST /api/admin/coadmins/:userId/revoke - Remove user from District Co-Admin (revert to USER)
  router.post('/coadmins/:userId/revoke', async (c) => {
    const user = c.get('user')!;
    if (user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Forbidden: Super Admin only.' }, 403);
    }

    const targetUserId = c.req.param('userId');
    const target = await db
      .prepare('SELECT id, pno, full_name, role, district_id FROM users WHERE id = ?')
      .bind(targetUserId)
      .first<any>();

    if (!target) {
      return c.json({ error: 'User not found.' }, 404);
    }

    if (target.role !== ROLES.DISTRICT_CO_ADMIN) {
      return c.json({ error: 'User is not currently a District Co-Admin.' }, 400);
    }

    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE users SET role = 'USER', updated_at = ? WHERE id = ?`)
      .bind(now, targetUserId)
      .run();

    await logAuditEvent(db, {
      actor: user,
      action: 'REVOKE_COADMIN_ROLE',
      entityType: 'USER',
      entityId: targetUserId,
      districtScope: target.district_id || 'STATEWIDE',
      beforeState: { role: target.role },
      afterState: { role: 'USER' },
    });

    return c.json({ success: true, message: `District Co-Admin privileges revoked for ${target.full_name} (${target.pno}). Reverted to standard User.` });
  });

  // GET /api/admin/devices - Device Management Logs (Super Admin only)
  router.get('/devices', async (c) => {
    const user = c.get('user')!;
    if (user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Forbidden: Super Admin only.' }, 403);
    }

    const { results } = await db
      .prepare(
        `SELECT dev.*, u.pno as userPno, u.full_name as userName, d.name as userDistrict
         FROM devices dev
         JOIN users u ON dev.user_id = u.id
         JOIN districts d ON u.district_id = d.id
         ORDER BY dev.last_seen_at DESC LIMIT 100`
      )
      .all();

    return c.json({ devices: results });
  });

  // POST /api/admin/devices/:deviceId/revoke - Revoke active device
  router.post('/devices/:deviceId/revoke', async (c) => {
    const user = c.get('user')!;
    const deviceId = c.req.param('deviceId');

    const dev = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first<any>();
    if (!dev) return c.json({ error: 'Device not found' }, 404);

    // Super Admin can revoke any device, User can revoke own device
    if (user.role !== ROLES.SUPER_ADMIN && dev.user_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await db.prepare('UPDATE devices SET is_active = 0 WHERE id = ?').bind(deviceId).run();
    await db.prepare('UPDATE sessions SET is_revoked = 1 WHERE device_id = ?').bind(deviceId).run();

    await logAuditEvent(db, {
      actor: user,
      action: 'REVOKE_DEVICE_SESSION',
      entityType: 'DEVICE',
      entityId: deviceId,
    });

    return c.json({ success: true, message: 'Device and active session revoked.' });
  });

  // GET /api/admin/audit-logs (Super Admin only)
  router.get('/audit-logs', async (c) => {
    const user = c.get('user')!;
    if (user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Forbidden: Super Admin only.' }, 403);
    }

    const { results } = await db
      .prepare(`SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 150`)
      .all();

    return c.json({ auditLogs: results });
  });

  // GET /api/admin/backup/status & POST /api/admin/backup/trigger
  router.get('/backup/status', async (c) => {
    const user = c.get('user')!;
    if (user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Forbidden: Super Admin only.' }, 403);
    }
    const status = await getLatestBackupStatus(db);
    return c.json({ latestBackup: status });
  });

  router.post('/backup/trigger', async (c) => {
    const user = c.get('user')!;
    if (user.role !== ROLES.SUPER_ADMIN) {
      return c.json({ error: 'Forbidden: Super Admin only.' }, 403);
    }
    const result = await executeBackup(db, `SUPER_ADMIN_${user.pno}`);
    return c.json({ success: result.status === 'SUCCESS', result });
  });

  // POST /api/admin/backup/restore-rehearsal
  router.post('/backup/restore-rehearsal', async (c) => {
    const user = c.get('user')!;
    const body = await c.req.json();
    const result = await restoreFromBackup(db, body.backupJobId, user);
    return c.json(result);
  });

  return router;
}
