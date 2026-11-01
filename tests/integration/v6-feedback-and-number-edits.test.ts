import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { hashPassword } from '../../apps/api/src/services/auth';

describe('V6 Real-Time Feedback, Compulsory Notices & Scoped Number Edits Test Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let superAdminToken: string;
  let coAdminLkoToken: string;
  let coAdminKpnToken: string;
  let userLkoToken: string;
  let userKpnToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    const pwHash = hashPassword('SecurePass@2026');

    // Seed Super Admin, Lucknow Co-Admin, Kanpur Co-Admin, Lucknow User, Kanpur User
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES 
         ('usr_sa', '0000000001', 'DGP State Admin', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9800000001', 'ACTIVE', 'SUPER_ADMIN', ?),
         ('usr_co_lko', '0000000002', 'ASP Lucknow CoAdmin', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9800000002', 'ACTIVE', 'DISTRICT_CO_ADMIN', ?),
         ('usr_co_kpn', '0000000005', 'ASP Kanpur CoAdmin', 'desig_asp', 'dist_kanpur_nagar', 'stn_kpn_kotwali', '9800000005', 'ACTIVE', 'DISTRICT_CO_ADMIN', ?),
         ('usr_lko_user', '1000000003', 'Inspector Lucknow User', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9811111111', 'ACTIVE', 'USER', ?),
         ('usr_kpn_user', '2000000004', 'Sub Inspector Kanpur User', 'desig_si', 'dist_kanpur_nagar', 'stn_kpn_kotwali', '9822222222', 'ACTIVE', 'USER', ?)`
      )
      .bind(pwHash, pwHash, pwHash, pwHash, pwHash)
      .run();

    // Authenticate tokens
    const saRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '0000000001', password: 'SecurePass@2026' }),
    });
    superAdminToken = (await saRes.json()).token;

    const coLkoRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '0000000002', password: 'SecurePass@2026' }),
    });
    coAdminLkoToken = (await coLkoRes.json()).token;

    const coKpnRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '0000000005', password: 'SecurePass@2026' }),
    });
    coAdminKpnToken = (await coKpnRes.json()).token;

    const uLkoRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '1000000003', password: 'SecurePass@2026' }),
    });
    userLkoToken = (await uLkoRes.json()).token;

    const uKpnRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '2000000004', password: 'SecurePass@2026' }),
    });
    userKpnToken = (await uKpnRes.json()).token;
  });

  // =========================================================================
  // Requirement 1: Real-Time Feedback System
  // =========================================================================
  describe('Requirement 1: Real-Time User Feedback System', () => {
    it('allows a regular officer to submit real-time feedback with category, rating, and message', async () => {
      const res = await app.request('/api/feedback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'SUGGESTION',
          subject: 'Add quick emergency helpline shortcut',
          message: 'Please add a direct helpline shortcut on directory screen for faster access.',
          rating: 5,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('feedbackId');
    });

    it('rejects feedback submission with invalid category or short text', async () => {
      const res = await app.request('/api/feedback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'INVALID_CATEGORY',
          subject: 'Hi',
          message: 'Test',
        }),
      });
      expect(res.status).toBe(422);
    });

    it('allows Super Admin to view all statewide feedbacks and Co-Admin to view district-scoped feedbacks', async () => {
      // 1. Submit feedback from Lucknow user
      await app.request('/api/feedback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'DATA_CORRECTION',
          subject: 'Hazratganj PS phone update',
          message: 'Hazratganj Thana phone number needs updating to 0522-2200001.',
          rating: 4,
        }),
      });

      // 2. Submit feedback from Kanpur user
      await app.request('/api/feedback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userKpnToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'BUG_REPORT',
          subject: 'Search lag in Kotwali',
          message: 'Search takes 2 seconds to filter Kotwali records.',
          rating: 3,
        }),
      });

      // 3. Super Admin queries all feedbacks -> sees both (2 feedbacks)
      const saRes = await app.request('/api/feedback', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(saRes.status).toBe(200);
      const saData = await saRes.json();
      expect(saData.feedbacks.length).toBe(2);

      // 4. Lucknow Co-Admin queries feedbacks -> strictly sees only Lucknow user feedback (1 feedback)
      const lkoRes = await app.request('/api/feedback', {
        headers: { Authorization: `Bearer ${coAdminLkoToken}` },
      });
      expect(lkoRes.status).toBe(200);
      const lkoData = await lkoRes.json();
      expect(lkoData.feedbacks.length).toBe(1);
      expect(lkoData.feedbacks[0].districtId).toBe('dist_lucknow');

      // 5. Kanpur Co-Admin queries feedbacks -> strictly sees only Kanpur user feedback (1 feedback)
      const kpnRes = await app.request('/api/feedback', {
        headers: { Authorization: `Bearer ${coAdminKpnToken}` },
      });
      expect(kpnRes.status).toBe(200);
      const kpnData = await kpnRes.json();
      expect(kpnData.feedbacks.length).toBe(1);
      expect(kpnData.feedbacks[0].districtId).toBe('dist_kanpur_nagar');
    });

    it('allows Admin to update feedback review status and resolve feedback', async () => {
      const fbCreate = await app.request('/api/feedback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'SUGGESTION',
          subject: 'Night roster notice request',
          message: 'Please publish night patrol roster by 6 PM daily.',
        }),
      });
      const { feedbackId } = await fbCreate.json();

      // Lucknow Co-Admin marks feedback as RESOLVED
      const resolveRes = await app.request(`/api/feedback/${feedbackId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'RESOLVED',
          adminNotes: 'Addressed in today district circular.',
        }),
      });
      expect(resolveRes.status).toBe(200);
      const resolveData = await resolveRes.json();
      expect(resolveData.status).toBe('RESOLVED');
    });
  });

  // =========================================================================
  // Requirement 2: Compulsory Notice Reading
  // =========================================================================
  describe('Requirement 2: Compulsory Departmental Notice Reading Flow', () => {
    it('creates notice, identifies unread status for target users, and marks acknowledged', async () => {
      // 1. Super Admin publishes an urgent notice
      const pubRes = await app.request('/api/notices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Mandatory VIP Security Deployment Order',
          body: 'All station house officers must ensure strict 24/7 security deployment effective immediately.',
          urgency: 'URGENT',
          targetScope: 'STATEWIDE',
        }),
      });
      expect(pubRes.status).toBe(200);
      const { noticeId } = await pubRes.json();

      // 2. User checks notices -> initially unread (isRead === 0, isAcknowledged === 0)
      const listRes = await app.request('/api/notices', {
        headers: { Authorization: `Bearer ${userLkoToken}` },
      });
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      const targetNotice = listData.notices.find((n: any) => n.id === noticeId);
      expect(targetNotice).toBeDefined();
      expect(targetNotice.isRead).toBe(0);
      expect(targetNotice.isAcknowledged).toBe(0);

      // 3. User marks notice as read
      const readRes = await app.request(`/api/notices/${noticeId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userLkoToken}` },
      });
      expect(readRes.status).toBe(200);

      // 4. User formally acknowledges compulsory notice
      const ackRes = await app.request(`/api/notices/${noticeId}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userLkoToken}` },
      });
      expect(ackRes.status).toBe(200);

      // 5. Re-check -> isRead === 1, isAcknowledged === 1
      const recheckRes = await app.request('/api/notices', {
        headers: { Authorization: `Bearer ${userLkoToken}` },
      });
      const recheckData = await recheckRes.json();
      const acknowledgedNotice = recheckData.notices.find((n: any) => n.id === noticeId);
      expect(acknowledgedNotice.isRead).toBe(1);
      expect(acknowledgedNotice.isAcknowledged).toBe(1);
    });
  });

  // =========================================================================
  // Requirement 3: Co-Admin Number-Only Edit Permission
  // =========================================================================
  describe('Requirement 3: Co-Admin Contact Number Only Edit Permission', () => {
    it('allows Co-Admin to edit mobile number of an officer in their district', async () => {
      const res = await app.request('/api/admin/users/usr_lko_user/details', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobile: '9899887766',
        }),
      });
      expect(res.status).toBe(200);

      // Verify in DB
      const updatedUser = await db.prepare('SELECT mobile FROM users WHERE id = ?').bind('usr_lko_user').first<any>();
      expect(updatedUser.mobile).toBe('9899887766');
    });

    it('strictly forbids Co-Admin from changing name or designation of an officer (Number Edit Only)', async () => {
      const res = await app.request('/api/admin/users/usr_lko_user/details', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Unauthorized New Name',
          mobile: '9899887766',
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('strictly authorized to edit contact numbers only');
    });

    it('allows Co-Admin to edit station/office phone in their assigned district', async () => {
      const res = await app.request('/api/admin/stations/stn_lko_hazratganj/phone', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: '0522-2200111',
        }),
      });
      expect(res.status).toBe(200);

      const stn = await db.prepare('SELECT phone FROM stations_offices WHERE id = ?').bind('stn_lko_hazratganj').first<any>();
      expect(stn.phone).toBe('0522-2200111');
    });

    it('strictly forbids Co-Admin from editing station/office phone in another district', async () => {
      const res = await app.request('/api/admin/stations/stn_kpn_kotwali/phone', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: '0512-2300000',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('strictly forbids Co-Admin from altering station name/type in master PUT route', async () => {
      const res = await app.request('/api/masters/stations/stn_lko_hazratganj', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Renamed Thana Hazratganj',
          phone: '0522-2200999',
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('strictly authorized to edit station/office phone numbers only');
    });

    it('allows Co-Admin to add a new departmental office in their assigned district', async () => {
      const res = await app.request('/api/masters/stations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          districtId: 'dist_lucknow',
          name: 'Circle Office Mahanagar',
          type: 'CIRCLE_OFFICE',
          phone: '0522-2334455',
          address: 'Mahanagar Sector B',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.stationId).toBeDefined();

      const created = await db.prepare('SELECT name, type, phone FROM stations_offices WHERE id = ?').bind(data.stationId).first<any>();
      expect(created.name).toBe('Circle Office Mahanagar');
      expect(created.type).toBe('CIRCLE_OFFICE');
      expect(created.phone).toBe('0522-2334455');
    });

    it('strictly forbids Co-Admin from creating a POLICE_STATION (State HQ Level Only)', async () => {
      const res = await app.request('/api/masters/stations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          districtId: 'dist_lucknow',
          name: 'Thana New Colony',
          type: 'POLICE_STATION',
          phone: '0522-2998877',
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Police Stations are established at State Headquarters level');
    });

    it('strictly forbids Co-Admin from creating an office in another district', async () => {
      const res = await app.request('/api/masters/stations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          districtId: 'dist_kanpur_nagar',
          name: 'Circle Office Kanpur Unauthorized',
          type: 'CIRCLE_OFFICE',
          phone: '0512-2998877',
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('may only add offices within your assigned district');
    });
  });
});
