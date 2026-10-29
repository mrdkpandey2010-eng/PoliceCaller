import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { Role, ROLES } from '@police-directory/shared';

export interface AuthenticatedUser {
  id: string;
  userId: string;
  pno: string;
  fullName: string;
  role: Role;
  districtId: string;
  districtName?: string;
  stationOfficeId: string;
  stationOfficeName?: string;
  status: string;
  termsAcceptedVersion?: string | null;
  notificationPref?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(computedHash, 'hex'));
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: D1Database,
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  platform: 'WEB' | 'ANDROID' | 'IOS' = 'WEB',
  deviceName: string = 'Standard Client'
): Promise<{ token: string; sessionId: string; expiresAt: string }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const sessionId = `sess_${crypto.randomUUID()}`;
  const deviceId = `dev_${crypto.randomUUID()}`;
  
  // 30 days expiration
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Create or update device record
  await db
    .prepare(
      `INSERT INTO devices (id, user_id, platform, device_name, is_active, last_seen_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(user_id, platform, device_name) DO UPDATE SET
         is_active = 1,
         last_seen_at = excluded.last_seen_at`
    )
    .bind(deviceId, userId, platform, deviceName, now)
    .run();

  // Insert session
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, device_id, token_hash, ip_address, user_agent, expires_at, is_revoked)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .bind(sessionId, userId, deviceId, tokenHash, ipAddress || '127.0.0.1', userAgent || 'Client', expiresAt)
    .run();

  return { token, sessionId, expiresAt };
}

export async function validateSession(db: D1Database, token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);

  const query = `
    SELECT 
      u.id, u.pno, u.full_name as fullName, u.role, u.status,
      u.district_id as districtId, d.name as districtName,
      u.station_office_id as stationOfficeId, s.name as stationOfficeName,
      u.terms_accepted_version as termsAcceptedVersion,
      u.notification_pref as notificationPref,
      sess.expires_at as expiresAt, sess.is_revoked as isRevoked
    FROM sessions sess
    JOIN users u ON sess.user_id = u.id
    LEFT JOIN districts d ON u.district_id = d.id
    LEFT JOIN stations_offices s ON u.station_office_id = s.id
    WHERE sess.token_hash = ? AND sess.is_revoked = 0
  `;

  const session = await db.prepare(query).bind(tokenHash).first<any>();
  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) {
    // Session expired
    return null;
  }

  return {
    id: session.id,
    userId: session.id,
    pno: session.pno,
    fullName: session.fullName,
    role: session.role as Role,
    districtId: session.districtId,
    districtName: session.districtName,
    stationOfficeId: session.stationOfficeId,
    stationOfficeName: session.stationOfficeName,
    status: session.status,
    termsAcceptedVersion: session.termsAcceptedVersion,
    notificationPref: session.notificationPref,
  };
}

export async function revokeSession(db: D1Database, token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const result = await db
    .prepare(`UPDATE sessions SET is_revoked = 1 WHERE token_hash = ?`)
    .bind(tokenHash)
    .run();
  return result.meta.changes > 0;
}

export async function revokeAllUserSessions(db: D1Database, userId: string): Promise<number> {
  const result = await db
    .prepare(`UPDATE sessions SET is_revoked = 1 WHERE user_id = ?`)
    .bind(userId)
    .run();
  return result.meta.changes;
}
