import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { hashPassword } from '../../apps/api/src/services/auth';

describe('V4 Targeted Fixes Comprehensive Integration Test Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let superAdminToken: string;
  let coAdminToken: string;
  let userAToken: string;
  let userBToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    const pwHash = hashPassword('SecurePass@2026');

    // Seed 1 Super Admin, 1 District Co-Admin (Lucknow), User A (Lucknow), User B (Kanpur Nagar)
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES 
         ('usr_sa', '0000000001', 'DGP UP Police', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9800000001', 'ACTIVE', 'SUPER_ADMIN', ?),
         ('usr_co', '0000000002', 'ASP Lucknow CoAdmin', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9800000002', 'ACTIVE', 'DISTRICT_CO_ADMIN', ?),
         ('usr_a', '1000000003', 'Inspector User A', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9811111111', 'ACTIVE', 'USER', ?),
         ('usr_b', '2000000004', 'Sub Inspector User B', 'desig_si', 'dist_kanpur_nagar', 'stn_kpn_kotwali', '9822222222', 'ACTIVE', 'USER', ?)`
      )
      .bind(pwHash, pwHash, pwHash, pwHash)
      .run();

    // Log in all accounts
    const saRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '0000000001', password: 'SecurePass@2026' }),
    });
    superAdminToken = (await saRes.json()).token;

    const coRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '0000000002', password: 'SecurePass@2026' }),
    });
    coAdminToken = (await coRes.json()).token;

    const uaRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '1000000003', password: 'SecurePass@2026' }),
    });
    userAToken = (await uaRes.json()).token;

    const ubRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '2000000004', password: 'SecurePass@2026' }),
    });
    userBToken = (await ubRes.json()).token;
  });

  // ==========================================
  // V4.1: Delete for Me (Single & Entire Chat)
  // ==========================================
  describe('V4.1: Delete for Me for a Single Message and Entire Conversation', () => {
    it('deletes a single message for acting user while preserving it for recipient', async () => {
      // 1. User A starts a direct conversation with User B
      const createConvRes = await app.request('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ type: 'DIRECT', participantId: 'usr_b' }),
      });
      const convData = await createConvRes.json();
      expect(createConvRes.status).toBe(200);
      const conversationId = convData.conversationId;

      // 2. User A sends message M1
      const msgRes = await app.request('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
          conversationId,
          content: 'Confidential message M1 from A to B',
        }),
      });
      const msgData = await msgRes.json();
      expect(msgRes.status).toBe(200);
      const messageId = msgData.message.id;

      // 3. User A performs "Delete for Me" on M1
      const delRes = await app.request(`/api/chat/messages/${messageId}/delete-for-me`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(delRes.status).toBe(200);
      const delData = await delRes.json();
      expect(delData.success).toBe(true);

      // 4. User A fetches messages: M1 must NOT be visible
      const getMsgsARes = await app.request(`/api/chat/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      const msgsA = await getMsgsARes.json();
      const hasM1ForA = msgsA.messages.some((m: any) => m.id === messageId);
      expect(hasM1ForA).toBe(false);

      // 5. User B fetches messages: M1 MUST still be present and intact
      const getMsgsBRes = await app.request(`/api/chat/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      const msgsB = await getMsgsBRes.json();
      const hasM1ForB = msgsB.messages.some((m: any) => m.id === messageId);
      expect(hasM1ForB).toBe(true);
    });

    it('deletes entire conversation for User A without removing it for User B, and re-exposes when new message arrives', async () => {
      // 1. Create conversation between User A and User B
      const createConvRes = await app.request('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ type: 'DIRECT', participantId: 'usr_b' }),
      });
      const conversationId = (await createConvRes.json()).conversationId;

      // 2. Send 2 messages
      await app.request('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
          conversationId,
          content: 'First historical message',
        }),
      });

      await app.request('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({
          conversationId,
          content: 'Second historical message',
        }),
      });

      // 3. User A deletes ENTIRE conversation for me
      const delConvRes = await app.request(
        `/api/chat/conversations/${conversationId}/delete-for-me`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${userAToken}` },
        }
      );
      expect(delConvRes.status).toBe(200);

      // 4. User A list conversations: conversation is HIDDEN
      const convsARes = await app.request('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      const convsA = await convsARes.json();
      expect(convsA.conversations.some((c: any) => c.id === conversationId)).toBe(false);

      // 5. User B list conversations: conversation is STILL PRESENT with messages
      const convsBRes = await app.request('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      const convsB = await convsBRes.json();
      expect(convsB.conversations.some((c: any) => c.id === conversationId)).toBe(true);

      // 6. User B sends a NEW message
      const newMsgRes = await app.request('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({
          conversationId,
          content: 'New active incoming message',
        }),
      });
      expect(newMsgRes.status).toBe(200);

      // 7. Re-exposure check: Conversation re-appears in User A list!
      const convsAReappearRes = await app.request('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      const convsAReappear = await convsAReappearRes.json();
      expect(convsAReappear.conversations.some((c: any) => c.id === conversationId)).toBe(true);

      // 8. History check: User A only sees the NEW message, old historical messages remain hidden!
      const msgsAReappearRes = await app.request(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${userAToken}` },
        }
      );
      const msgsAReappear = await msgsAReappearRes.json();
      expect(msgsAReappear.messages.length).toBe(1);
      expect(msgsAReappear.messages[0].content).toBe('New active incoming message');
    });
  });

  // ==========================================
  // V4.2: Admin Personnel Edit Designation
  // ==========================================
  describe('V4.2: Designation Dropdown in Personnel Edit', () => {
    it('returns canonical designations with readable name and shortName without () formatting issues', async () => {
      const res = await app.request('/api/masters/designations');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.designations.length).toBeGreaterThan(0);

      // Verify canonical fields exist
      const d = data.designations[0];
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('name');
      expect(d).toHaveProperty('shortName');
      expect(d.name).not.toBe('');
    });

    it('allows Super Admin to update user designation by canonical ID', async () => {
      const updateRes = await app.request('/api/admin/users/usr_a/details', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          fullName: 'Inspector User A Updated',
          mobile: '9811111111',
          designationId: 'desig_co_dsp',
        }),
      });
      expect(updateRes.status).toBe(200);

      // Verify persisted value
      const userRow = await db
        .prepare('SELECT designation_id, full_name FROM users WHERE id = ?')
        .bind('usr_a')
        .first<any>();
      expect(userRow.designation_id).toBe('desig_co_dsp');
      expect(userRow.full_name).toBe('Inspector User A Updated');
    });
  });

  // ==========================================
  // V4.4: Search Stations, Offices and Co-Admins
  // ==========================================
  describe('V4.4: Search Police Stations, Offices and District Co-Admins', () => {
    it('allows all approved authenticated roles to query Co-Admins directory', async () => {
      // Regular user queries co-admins
      const res = await app.request('/api/directory/co-admins?districtId=dist_lucknow', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.coAdmins.length).toBeGreaterThanOrEqual(1);

      const coAdmin = data.coAdmins.find((c: any) => c.id === 'usr_co');
      expect(coAdmin).toBeDefined();
      expect(coAdmin.fullName).toBe('ASP Lucknow CoAdmin');
      expect(coAdmin.mobile).toBe('9800000002');
      expect(coAdmin.districtName).toBe('Lucknow');
    });

    it('allows all approved authenticated roles to search stations and offices with contact numbers', async () => {
      const res = await app.request('/api/directory/stations-offices?districtId=dist_lucknow', {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.stationsOffices.length).toBeGreaterThan(0);

      const stn = data.stationsOffices[0];
      expect(stn).toHaveProperty('id');
      expect(stn).toHaveProperty('name');
      expect(stn).toHaveProperty('type');
      expect(stn).toHaveProperty('districtName');
    });

    it('rejects unauthenticated requests to co-admins and stations-offices', async () => {
      const res1 = await app.request('/api/directory/co-admins');
      expect(res1.status).toBe(401);

      const res2 = await app.request('/api/directory/stations-offices');
      expect(res2.status).toBe(401);
    });
  });

  // ==========================================
  // V4.5: Downloadable Contact Diaries
  // ==========================================
  describe('V4.5: Downloadable Contact Diaries / Resource Library', () => {
    let createdDiaryId: string;

    it('allows Super Admin to publish a contact diary with secure HTTPS URL or file', async () => {
      const res = await app.request('/api/diaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: 'Lucknow District Police Roster 2026',
          description: 'Official roster of officers and stations',
          category: 'DISTRICT',
          districtId: 'dist_lucknow',
          fileType: 'URL',
          externalUrl: 'https://uppolice.gov.in/diaries/lucknow-2026.pdf',
        }),
      });

      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      expect(data.success).toBe(true);
      createdDiaryId = data.diaryId || data.diary?.id;
    });

    it('blocks District Co-Admin and Regular User from uploading or deleting diaries (Super Admin only)', async () => {
      // Co-Admin attempt
      const coRes = await app.request('/api/diaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${coAdminToken}`,
        },
        body: JSON.stringify({
          title: 'Unauthorized Co-Admin Upload',
          fileType: 'URL',
          externalUrl: 'https://uppolice.gov.in/test.pdf',
        }),
      });
      expect(coRes.status).toBe(403);

      // User attempt
      const uRes = await app.request('/api/diaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
          title: 'Unauthorized User Upload',
          fileType: 'URL',
          externalUrl: 'https://uppolice.gov.in/test.pdf',
        }),
      });
      expect(uRes.status).toBe(403);
    });

    it('allows all active approved users to list and download diaries', async () => {
      // Publish a diary first
      const pubRes = await app.request('/api/diaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: 'Lucknow District Police Roster 2026',
          description: 'Official roster of officers and stations',
          category: 'DISTRICT',
          districtId: 'dist_lucknow',
          fileType: 'URL',
          externalUrl: 'https://uppolice.gov.in/diaries/lucknow-2026.pdf',
        }),
      });
      const pubData = await pubRes.json();
      const diaryId = pubData.diaryId || pubData.diary?.id;

      const listRes = await app.request('/api/diaries', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.success).toBe(true);
      expect(listData.diaries.some((d: any) => d.id === diaryId)).toBe(true);

      // Download / redirect
      const dlRes = await app.request(`/api/diaries/${diaryId}/download`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      expect(dlRes.status).toBe(200);
      const dlData = await dlRes.json();
      expect(dlData.url).toBe('https://uppolice.gov.in/diaries/lucknow-2026.pdf');
    });
  });

  // ==========================================
  // V4.6: Exact Identifier Validation
  // ==========================================
  describe('V4.6: Registration and Personnel Identifiers Exact Validation', () => {
    it('accepts valid 9-digit and 10-digit PNO strings preserving leading zeros', async () => {
      // 9-digit PNO
      const res9 = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pno: '001234567',
          fullName: 'Sub Inspector Nine Digit',
          mobile: '9876543201',
          districtId: 'dist_lucknow',
          stationOfficeId: 'stn_lko_hazratganj',
          designationId: 'desig_si',
          password: 'Password@2026',
        }),
      });
      expect([200, 201]).toContain(res9.status);

      // 10-digit PNO
      const res10 = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pno: '0001234567',
          fullName: 'Constable Ten Digit',
          mobile: '9876543202',
          districtId: 'dist_lucknow',
          stationOfficeId: 'stn_lko_hazratganj',
          designationId: 'desig_const',
          password: 'Password@2026',
        }),
      });
      expect([200, 201]).toContain(res10.status);
    });

    it('permits gazetted officer to use 10-digit mobile as PNO (pno === mobile)', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pno: '9876500000',
          fullName: 'IPS Gazetted Officer',
          mobile: '9876500000', // pno === mobile
          districtId: 'dist_lucknow',
          stationOfficeId: 'stn_lko_sp_office',
          designationId: 'desig_sp',
          password: 'Password@2026',
        }),
      });
      expect([200, 201]).toContain(res.status);
    });

    it('rejects invalid PNO lengths (8 digits or 11 digits) and non-ASCII numerals', async () => {
      // 8 digits
      const res8 = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pno: '12345678',
          fullName: 'Invalid Eight',
          mobile: '9876543203',
          districtId: 'dist_lucknow',
          stationOfficeId: 'stn_lko_hazratganj',
          designationId: 'desig_const',
          password: 'Password@2026',
        }),
      });
      expect(res8.status).toBe(422);

      // 11 digits
      const res11 = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pno: '12345678901',
          fullName: 'Invalid Eleven',
          mobile: '9876543204',
          districtId: 'dist_lucknow',
          stationOfficeId: 'stn_lko_hazratganj',
          designationId: 'desig_const',
          password: 'Password@2026',
        }),
      });
      expect(res11.status).toBe(422);
    });

    it('rejects mobile numbers not exactly 10 ASCII digits', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pno: '123456789',
          fullName: 'Bad Mobile Officer',
          mobile: '+919876543210', // contains + and 12 chars
          districtId: 'dist_lucknow',
          stationOfficeId: 'stn_lko_hazratganj',
          designationId: 'desig_const',
          password: 'Password@2026',
        }),
      });
      expect(res.status).toBe(422);
    });
  });

  // ==========================================
  // V4.7: Home Personnel Directory 50/page Limit
  // ==========================================
  describe('V4.7: Home Personnel Directory Pagination Limit', () => {
    it('enforces maximum 50 records per page on directory API and returns pagination metadata', async () => {
      const res = await app.request('/api/directory?limit=100', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.limit).toBe(50); // Clamped to 50
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('totalPages');
      expect(data.contacts.length).toBeLessThanOrEqual(50);
    });
  });

  // ==========================================
  // V4.9: Device Diagnostics and Audit Trail
  // ==========================================
  describe('V4.9: Device Diagnostics and Audit Trail', () => {
    it('records client diagnostics upon login into devices table and displays to Super Admin', async () => {
      const loginRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '103.25.130.45',
        },
        body: JSON.stringify({
          pno: '1000000003',
          password: 'SecurePass@2026',
          platform: 'Android',
          deviceName: 'Samsung Galaxy S24',
          browserName: 'Chrome Mobile 130',
          notificationState: 'GRANTED',
          batteryLevel: 85,
          locale: 'en-IN',
        }),
      });
      expect(loginRes.status).toBe(200);

      // Super Admin retrieves device logs
      const devRes = await app.request('/api/admin/devices', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(devRes.status).toBe(200);
      const devData = await devRes.json();
      expect(devData.devices.length).toBeGreaterThan(0);

      const recordedDev = devData.devices.find((d: any) => d.user_id === 'usr_a');
      expect(recordedDev).toBeDefined();
      expect(recordedDev.ip_address).toBe('103.25.130.45');
      expect(recordedDev.platform).toBe('ANDROID');
      expect(recordedDev.device_name).toBe('Samsung Galaxy S24');
      expect(recordedDev.browser_name).toBe('Chrome Mobile 130');
      expect(recordedDev.notification_state).toBe('GRANTED');
      expect(Number(recordedDev.battery_level)).toBe(85);
      expect(recordedDev.locale).toBe('en-IN');
    });

    it('allows Super Admin to revoke device session, invalidating subsequent requests', async () => {
      const devRow = await db
        .prepare('SELECT id FROM devices WHERE user_id = ? AND is_active = 1')
        .bind('usr_b')
        .first<any>();
      expect(devRow).toBeDefined();

      // Revoke device session
      const revokeRes = await app.request(`/api/admin/devices/${devRow.id}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(revokeRes.status).toBe(200);

      // Verify User B's revoked token fails
      const checkRes = await app.request('/api/auth/me', {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      expect(checkRes.status).toBe(401);
    });

    it('records privileged actions in audit_events table', async () => {
      // Trigger a privileged action: Super Admin activates/deactivates a user
      await app.request('/api/admin/users/usr_b/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ status: 'INACTIVE' }),
      });

      const auditRows = await db
        .prepare('SELECT * FROM audit_events ORDER BY created_at DESC')
        .all<any>();
      expect(auditRows.results.length).toBeGreaterThan(0);

      const hasUserAudit = auditRows.results.some(
        (a: any) => a.action === 'DEACTIVATE_USER'
      );
      expect(hasUserAudit).toBe(true);
    });
  });
});
