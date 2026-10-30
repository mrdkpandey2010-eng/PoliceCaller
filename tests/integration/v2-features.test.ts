import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { hashPassword } from '../../apps/api/src/services/auth';

describe('V2 Master Specification Features Test Suite', () => {
  let db: LocalD1Database;
  let app: any;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    // Seed test users
    const pwHash = hashPassword('TestPass@2026');
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES 
         ('usr_test_1', '00123456', 'Inspector Rakesh Kumar', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9876543210', 'ACTIVE', 'USER', ?),
         ('usr_test_pending', '00654321', 'Constable Amit Verma', 'desig_const', 'dist_lucknow', 'stn_lko_hazratganj', '9876543211', 'PENDING', 'USER', ?),
         ('usr_seed_super', '00000001', 'DGP Uttar Pradesh', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9800000001', 'ACTIVE', 'SUPER_ADMIN', ?)`
      )
      .bind(pwHash, pwHash, pwHash)
      .run();
  });

  describe('Screen 1: PNO / Mobile Identifier Lookup & Branching', () => {
    it('finds registered user by 8-digit PNO (preserving leading zero)', async () => {
      const res = await app.request('/api/auth/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '00123456' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.exists).toBe(true);
      expect(data.pno).toBe('00123456');
      expect(data.status).toBe('ACTIVE');
      expect(data.fullName).toBe('Inspector Rakesh Kumar');
    });

    it('finds registered user by 10-digit Mobile number', async () => {
      const res = await app.request('/api/auth/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '9876543210' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.exists).toBe(true);
      expect(data.pno).toBe('00123456');
      expect(data.status).toBe('ACTIVE');
    });

    it('branches to registration with prefill when identifier does not exist', async () => {
      const res = await app.request('/api/auth/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '9998887776' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.exists).toBe(false);
      expect(data.typedIdentifier).toBe('9998887776');
      expect(data.suggestedType).toBe('mobile');
    });

    it('allows login using Mobile number instead of PNO', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: '9876543210',
          password: 'TestPass@2026',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user.pno).toBe('00123456');
    });

    it('blocks login with 403 if account is still PENDING verification', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pno: '00654321',
          password: 'TestPass@2026',
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/pending departmental admin approval/i);
    });
  });

  describe('User Management: Edit Personnel Details', () => {
    let superAdminToken: string;

    beforeEach(async () => {
      // Login as Super Admin
      const loginRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pno: '00000001',
          password: 'TestPass@2026',
        }),
      });
      const data = await loginRes.json();
      superAdminToken = data.token;
    });

    it('allows Super Admin to update user name and mobile with English validation', async () => {
      const res = await app.request('/api/admin/users/usr_test_1/details', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          fullName: 'Inspector Rajesh V. Sharma',
          mobile: '9812345678',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify database update
      const updatedUser = await db
        .prepare('SELECT pno, full_name, mobile FROM users WHERE id = ?')
        .bind('usr_test_1')
        .first<any>();
      expect(updatedUser.pno).toBe('00123456'); // PNO remains unchanged
      expect(updatedUser.full_name).toBe('Inspector Rajesh V. Sharma');
      expect(updatedUser.mobile).toBe('9812345678');
    });

    it('rejects Non-English / Devanagari characters in user name update', async () => {
      const res = await app.request('/api/admin/users/usr_test_1/details', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          fullName: 'राजेश शर्मा',
        }),
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toMatch(/English letters/i);
    });

    it('allows Super Admin to appoint a user as District Co-Admin and then revoke their role', async () => {
      // 1. Appoint usr_test_1 as District Co-Admin
      const assignRes = await app.request('/api/admin/coadmins/usr_test_1/assign', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(assignRes.status).toBe(200);
      const assignData = await assignRes.json();
      expect(assignData.success).toBe(true);

      // Verify role in database
      const userInDb = await db.prepare('SELECT role FROM users WHERE id = ?').bind('usr_test_1').first<any>();
      expect(userInDb.role).toBe('DISTRICT_CO_ADMIN');

      // Verify appears in Co-Admins list
      const listRes = await app.request('/api/admin/coadmins', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const listData = await listRes.json();
      expect(listData.coAdmins.some((ca: any) => ca.id === 'usr_test_1')).toBe(true);

      // 2. Revoke District Co-Admin role
      const revokeRes = await app.request('/api/admin/coadmins/usr_test_1/revoke', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(revokeRes.status).toBe(200);
      const revokeData = await revokeRes.json();
      expect(revokeData.success).toBe(true);

      // Verify role reverted to USER
      const revertedUser = await db.prepare('SELECT role FROM users WHERE id = ?').bind('usr_test_1').first<any>();
      expect(revertedUser.role).toBe('USER');
    });

    it('forbids regular users from appointing or revoking Co-Admins', async () => {
      // Login as regular user
      const userLoginRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pno: '00123456', password: 'TestPass@2026' }),
      });
      const regularToken = (await userLoginRes.json()).token;

      const forbiddenAssign = await app.request('/api/admin/coadmins/usr_test_pending/assign', {
        method: 'POST',
        headers: { Authorization: `Bearer ${regularToken}` },
      });
      expect(forbiddenAssign.status).toBe(403);

      const forbiddenRevoke = await app.request('/api/admin/coadmins/usr_test_1/revoke', {
        method: 'POST',
        headers: { Authorization: `Bearer ${regularToken}` },
      });
      expect(forbiddenRevoke.status).toBe(403);
    });
  });

  describe('Messenger: Delete for Me Functionality', () => {
    let user1Token: string;
    let user2Token: string;
    let convId: string;

    beforeEach(async () => {
      // Insert user 2
      const pwHash = hashPassword('TestPass@2026');
      await db
        .prepare(
          `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
           VALUES ('usr_test_2', '00222222', 'Sub-Inspector Mohan Lal', 'desig_si', 'dist_lucknow', 'stn_lko_hazratganj', '9876543222', 'ACTIVE', 'USER', ?)`
        )
        .bind(pwHash)
        .run();

      const l1 = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pno: '00123456', password: 'TestPass@2026' }),
      });
      user1Token = (await l1.json()).token;

      const l2 = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pno: '00222222', password: 'TestPass@2026' }),
      });
      user2Token = (await l2.json()).token;

      // Create direct conversation
      const cRes = await app.request('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1Token}`,
        },
        body: JSON.stringify({ type: 'DIRECT', participantId: 'usr_test_2' }),
      });
      const cData = await cRes.json();
      convId = cData.conversationId;

      // Send a message from user 1
      await app.request('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1Token}`,
        },
        body: JSON.stringify({
          conversationId: convId,
          content: 'Confidential investigation brief',
        }),
      });
    });

    it('allows participant to Delete for Me entire conversation without deleting for other participant', async () => {
      // User 1 deletes entire conversation for me
      const delRes = await app.request(`/api/chat/conversations/${convId}/delete-for-me`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user1Token}` },
      });
      expect(delRes.status).toBe(200);

      // Verify User 1 sees 0 messages in the conversation
      const u1MsgsRes = await app.request(`/api/chat/messages/${convId}`, {
        headers: { Authorization: `Bearer ${user1Token}` },
      });
      const u1Msgs = await u1MsgsRes.json();
      expect(u1Msgs.messages.length).toBe(0);

      // Verify User 2 still sees the message
      const u2MsgsRes = await app.request(`/api/chat/messages/${convId}`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });
      const u2Msgs = await u2MsgsRes.json();
      expect(u2Msgs.messages.length).toBe(1);
      expect(u2Msgs.messages[0].content).toBe('Confidential investigation brief');
    });
  });
});
