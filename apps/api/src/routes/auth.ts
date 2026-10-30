import { Hono } from 'hono';
import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import {
  hashPassword,
  verifyPassword,
  createSession,
  revokeSession,
  AuthenticatedUser,
} from '../services/auth';
import { logAuditEvent } from '../services/audit';
import {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  ROLES,
} from '@police-directory/shared';

export function createAuthRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // POST /api/auth/lookup (Screen 1: PNO/Mobile identifier check)
  router.post('/lookup', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const identifier = String(body.identifier || '').trim();

      if (!identifier || !/^\d+$/.test(identifier)) {
        return c.json({ error: 'Please enter a valid numeric PNO or Mobile Number.' }, 400);
      }

      // Safe lookup by PNO or Mobile
      const matchingUsers = await db
        .prepare(
          `SELECT u.id, u.pno, u.mobile, u.status, u.full_name, u.photo_url, u.role,
                  d.name as district_name, des.name as designation_name
           FROM users u
           LEFT JOIN districts d ON u.district_id = d.id
           LEFT JOIN designations des ON u.designation_id = des.id
           WHERE u.pno = ? OR u.mobile = ?`
        )
        .bind(identifier, identifier)
        .all<any>();

      if (matchingUsers.results.length === 0) {
        return c.json({
          exists: false,
          typedIdentifier: identifier,
          suggestedType: identifier.length === 10 ? 'mobile' : 'pno',
        });
      }

      if (matchingUsers.results.length === 1) {
        const u = matchingUsers.results[0];
        return c.json({
          exists: true,
          pno: u.pno,
          fullName: u.full_name,
          status: u.status,
          designationName: u.designation_name,
          districtName: u.district_name,
          photoUrl: u.photo_url,
          maskedMobile: u.mobile ? '******' + u.mobile.slice(-4) : null,
        });
      }

      // If mobile is shared across multiple accounts, provide safe disambiguation
      return c.json({
        exists: true,
        multipleMatches: true,
        accounts: matchingUsers.results.map((u: any) => ({
          pno: u.pno,
          fullName: u.full_name,
          status: u.status,
          designationName: u.designation_name,
          districtName: u.district_name,
        })),
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Lookup failed.' }, 400);
    }
  });

  // POST /api/auth/register (USER self-registration)
  router.post('/register', async (c) => {
    try {
      const body = await c.req.json();
      const validated = RegisterSchema.parse(body);

      // Check duplicate PNO
      const existingPno = await db
        .prepare('SELECT id FROM users WHERE pno = ?')
        .bind(validated.pno)
        .first();

      if (existingPno) {
        return c.json(
          { error: 'A personnel record with this PNO already exists.' },
          409
        );
      }

      // Check duplicate Mobile
      const existingMobile = await db
        .prepare('SELECT id FROM users WHERE mobile = ?')
        .bind(validated.mobile)
        .first();

      if (existingMobile) {
        return c.json(
          { error: 'A personnel record with this mobile number already exists.' },
          409
        );
      }

      const userId = `usr_${crypto.randomUUID()}`;
      const passwordHash = hashPassword(validated.password);
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO users 
           (id, pno, full_name, designation_id, district_id, station_office_id, mobile, whatsapp, email, status, role, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'USER', ?, ?, ?)`
        )
        .bind(
          userId,
          validated.pno,
          validated.fullName,
          validated.designationId,
          validated.districtId,
          validated.stationOfficeId,
          validated.mobile,
          validated.whatsapp || null,
          validated.email || null,
          passwordHash,
          now,
          now
        )
        .run();

      await logAuditEvent(db, {
        actor: {
          id: userId,
          userId: userId,
          pno: validated.pno,
          fullName: validated.fullName,
          role: ROLES.USER,
          districtId: validated.districtId,
          stationOfficeId: validated.stationOfficeId,
          status: 'PENDING',
        },
        action: 'USER_SELF_REGISTRATION',
        entityType: 'USER',
        entityId: userId,
        districtScope: validated.districtId,
        afterState: { pno: validated.pno, fullName: validated.fullName, status: 'PENDING' },
      });

      return c.json({
        success: true,
        message: 'Registration submitted successfully. Your account is pending departmental admin approval.',
        userId,
      });
    } catch (err: any) {
      if (err.errors) {
        return c.json({ error: 'Validation failed', details: err.errors }, 422);
      }
      return c.json({ error: err.message || 'Registration failed' }, 400);
    }
  });

  // POST /api/auth/login
  router.post('/login', async (c) => {
    try {
      const body = await c.req.json();
      const identifier = String(body.pno || body.identifier || body.mobile || '').trim();
      const password = String(body.password || '');

      if (!identifier || !password) {
        return c.json({ error: 'PNO/Mobile and password are required.' }, 400);
      }

      const user = await db
        .prepare(
          `SELECT u.*, d.name as district_name, s.name as station_name
           FROM users u
           LEFT JOIN districts d ON u.district_id = d.id
           LEFT JOIN stations_offices s ON u.station_office_id = s.id
           WHERE u.pno = ? OR u.mobile = ?`
        )
        .bind(identifier, identifier)
        .first<any>();

      if (!user) {
        return c.json({ error: 'Invalid PNO/Mobile or password.' }, 401);
      }

      const isValidPassword = verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return c.json({ error: 'Invalid PNO/Mobile or password.' }, 401);
      }

      if (user.status === 'PENDING') {
        return c.json(
          {
            error: 'Account pending departmental admin approval.',
            status: 'PENDING',
          },
          403
        );
      }

      if (user.status === 'REJECTED' || user.status === 'INACTIVE') {
        return c.json(
          {
            error: `Your account is ${user.status.toLowerCase()}. Please contact your District Co-Admin or Super Admin.`,
            status: user.status,
          },
          403
        );
      }

      const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
      const userAgent = c.req.header('user-agent') || 'Browser';
      const platform = String(body.platform || '').toUpperCase() === 'ANDROID' ? 'ANDROID' : 'WEB';
      const deviceName = body.deviceName || (platform === 'ANDROID' ? 'Android Device' : 'Web Browser');

      const session = await createSession(
        db,
        user.id,
        clientIp,
        userAgent,
        platform,
        deviceName,
        {
          browserName: body.browserName || userAgent.split(' ')[0],
          osVersion: body.osVersion || null,
          appVersion: body.appVersion || '1.0.0',
          batteryLevel: body.batteryLevel || 'Unavailable',
          notificationState: body.notificationState || 'DEFAULT',
          locale: body.locale || 'en-IN',
        }
      );

      // Check current terms version
      const currentTerms = await db
        .prepare(`SELECT version FROM policies WHERE type = 'TERMS' AND is_active = 1 ORDER BY published_at DESC LIMIT 1`)
        .first<any>();

      const termsAccepted =
        Boolean(user.terms_accepted_version) &&
        user.terms_accepted_version === (currentTerms?.version || '1.0');

      return c.json({
        success: true,
        token: session.token,
        user: {
          id: user.id,
          pno: user.pno,
          fullName: user.full_name,
          role: user.role,
          status: user.status,
          districtId: user.district_id,
          districtName: user.district_name,
          stationOfficeId: user.station_office_id,
          stationOfficeName: user.station_name,
          photoUrl: user.photo_url,
          termsAcceptedVersion: user.terms_accepted_version,
          needsTermsAcceptance: !termsAccepted,
          notificationPref: user.notification_pref,
        },
      });
    } catch (err: any) {
      if (err.errors) {
        return c.json({ error: 'Validation failed', details: err.errors }, 422);
      }
      return c.json({ error: err.message || 'Login failed' }, 400);
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (c) => {
    const authHeader = c.req.header('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      await revokeSession(db, token);
    }
    return c.json({ success: true, message: 'Logged out successfully.' });
  });

  // POST /api/auth/terms/accept
  router.post('/terms/accept', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const version = body.version || '1.0';
    const clientIp = c.req.header('x-forwarded-for') || '127.0.0.1';
    const now = new Date().toISOString();

    const policy = await db
      .prepare(`SELECT id FROM policies WHERE version = ? AND type = 'TERMS'`)
      .bind(version)
      .first<any>();

    const policyId = policy?.id || 'pol_terms_v1';

    await db
      .prepare(
        `INSERT INTO policy_acceptances (id, user_id, policy_id, policy_version, accepted_at, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, policy_version) DO UPDATE SET accepted_at = excluded.accepted_at`
      )
      .bind(`pacc_${crypto.randomUUID()}`, user.id, policyId, version, now, clientIp)
      .run();

    await db
      .prepare(`UPDATE users SET terms_accepted_version = ?, terms_accepted_at = ? WHERE id = ?`)
      .bind(version, now, user.id)
      .run();

    return c.json({ success: true, message: 'Terms accepted.' });
  });

  // POST /api/auth/notification-pref
  router.post('/notification-pref', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const status = body.status || 'GRANTED'; // GRANTED, DENIED, UNSUPPORTED

    await db
      .prepare(`UPDATE users SET notification_pref = ? WHERE id = ?`)
      .bind(status, user.id)
      .run();

    return c.json({ success: true, status });
  });

  // GET /api/auth/me
  router.get('/me', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const currentTerms = await db
      .prepare(`SELECT version FROM policies WHERE type = 'TERMS' AND is_active = 1 ORDER BY published_at DESC LIMIT 1`)
      .first<any>();

    const needsTermsAcceptance =
      !user.termsAcceptedVersion ||
      user.termsAcceptedVersion !== (currentTerms?.version || '1.0');

    return c.json({
      user: {
        ...user,
        needsTermsAcceptance,
      },
    });
  });

  return router;
}
