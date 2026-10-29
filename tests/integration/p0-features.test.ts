import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { hashPassword } from '../../apps/api/src/services/auth';

describe('P0 Requirements Comprehensive Test Suite', () => {
  let db: LocalD1Database;
  let app: any;

  let superAdminId: string;
  let superToken: string;
  let lkoCoAdminId: string;
  let lkoCoToken: string;
  let vnsCoAdminId: string;
  let vnsCoToken: string;
  let officerAId: string;
  let officerAToken: string;
  let officerBId: string;
  let officerBToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    const now = new Date().toISOString();
    const pwHash = hashPassword('TestPassword@123');

    // 1. Super Admin
    superAdminId = 'usr_super_1';
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash, created_at, updated_at)
         VALUES (?, '00000001', 'Vikramaditya DGP', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9800000001', 'ACTIVE', 'SUPER_ADMIN', ?, ?, ?)`
      )
      .bind(superAdminId, pwHash, now, now)
      .run();

    // 2. Lucknow Co-Admin
    lkoCoAdminId = 'usr_lko_co';
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash, created_at, updated_at)
         VALUES (?, '00000002', 'Siddharth ASP', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9800000002', 'ACTIVE', 'DISTRICT_CO_ADMIN', ?, ?, ?)`
      )
      .bind(lkoCoAdminId, pwHash, now, now)
      .run();

    // 3. Varanasi Co-Admin
    vnsCoAdminId = 'usr_vns_co';
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash, created_at, updated_at)
         VALUES (?, '00000003', 'Anuradha ASP', 'desig_asp', 'dist_varanasi', 'stn_vns_sp_office', '9800000003', 'ACTIVE', 'DISTRICT_CO_ADMIN', ?, ?, ?)`
      )
      .bind(vnsCoAdminId, pwHash, now, now)
      .run();

    // 4. Officer A (Lucknow Inspector)
    officerAId = 'usr_off_a';
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash, created_at, updated_at)
         VALUES (?, '00112233', 'Rajesh Inspector', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9876543210', 'ACTIVE', 'USER', ?, ?, ?)`
      )
      .bind(officerAId, pwHash, now, now)
      .run();

    // 5. Officer B (Varanasi Inspector)
    officerBId = 'usr_off_b';
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash, created_at, updated_at)
         VALUES (?, '00223344', 'Kailash Inspector', 'desig_insp', 'dist_varanasi', 'stn_vns_cantt', '9876543220', 'ACTIVE', 'USER', ?, ?, ?)`
      )
      .bind(officerBId, pwHash, now, now)
      .run();

    // Log in users to get tokens
    const login = async (pno: string) => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pno, password: 'TestPassword@123' }),
      });
      const data = await res.json();
      return data.token;
    };

    superToken = await login('00000001');
    lkoCoToken = await login('00000002');
    vnsCoToken = await login('00000003');
    officerAToken = await login('00112233');
    officerBToken = await login('00223344');
  });

  // P0-1 & P0-2: Direct Chat and Group Creation
  it('P0-2: allows creating direct chat and group conversations with initial members', async () => {
    // 1. Create direct chat between Officer A and Officer B
    const directRes = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({
        type: 'DIRECT',
        participantId: officerBId,
      }),
    });

    expect(directRes.status).toBe(200);
    const directData = await directRes.json();
    expect(directData.success).toBe(true);
    expect(directData.conversationId).toBeDefined();

    // 2. Creating again reuses the unique conversationId without duplicates
    const directRes2 = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({
        type: 'DIRECT',
        participantId: officerBId,
      }),
    });
    const directData2 = await directRes2.json();
    expect(directData2.conversationId).toBe(directData.conversationId);
    expect(directData2.isNew).toBe(false);

    // 3. Create group with multiple members
    const groupRes = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({
        type: 'GROUP',
        groupTitle: 'Special Task Force Varanasi',
        memberIds: [officerBId, lkoCoAdminId],
      }),
    });

    expect(groupRes.status).toBe(200);
    const groupData = await groupRes.json();
    expect(groupData.success).toBe(true);
    const groupId = groupData.conversationId;

    // 4. Query group members
    const membersRes = await app.request(`/api/chat/conversations/${groupId}/members`, {
      headers: { Authorization: `Bearer ${officerAToken}` },
    });
    expect(membersRes.status).toBe(200);
    const membersData = await membersRes.json();
    expect(membersData.members.length).toBe(3); // Creator (Admin) + 2 members
  });

  // P0-3: Realtime Status, Typing, and Message Receipts
  it('P0-3: tracks presence heartbeat, typing indicators, and delivery/read receipts', async () => {
    // 1. Presence heartbeat
    const beatRes = await app.request('/api/chat/presence/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${officerAToken}` },
    });
    expect(beatRes.status).toBe(200);

    // 2. Check Officer A presence from Officer B session
    const presenceRes = await app.request(`/api/chat/presence/${officerAId}`, {
      headers: { Authorization: `Bearer ${officerBToken}` },
    });
    expect(presenceRes.status).toBe(200);
    const presenceData = await presenceRes.json();
    expect(presenceData.isOnline).toBe(true);

    // 3. Create direct conversation
    const convRes = await app.request('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({ type: 'DIRECT', participantId: officerBId }),
    });
    const { conversationId } = await convRes.json();

    // 4. Broadcast typing event
    const typeRes = await app.request('/api/chat/typing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({ conversationId }),
    });
    expect(typeRes.status).toBe(200);

    // 5. Officer B queries typing state
    const typingListRes = await app.request(`/api/chat/typing/${conversationId}`, {
      headers: { Authorization: `Bearer ${officerBToken}` },
    });
    const typingListData = await typingListRes.json();
    expect(typingListData.typingUsers).toContain('Rajesh Inspector');

    // 6. Officer A sends a message
    const sendRes = await app.request('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({
        conversationId,
        content: 'Reporting for VIP escort duty.',
      }),
    });
    expect(sendRes.status).toBe(200);

    // 7. Officer A checks message list: status should be delivered (Officer B exists in conversation)
    const listRes1 = await app.request(`/api/chat/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${officerAToken}` },
    });
    const listData1 = await listRes1.json();
    expect(listData1.messages[0].status).toBe('delivered');

    // 8. Officer B reads the conversation
    await app.request(`/api/chat/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${officerBToken}` },
    });

    // 9. Officer A checks message list again: status should now be 'read'
    const listRes2 = await app.request(`/api/chat/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${officerAToken}` },
    });
    const listData2 = await listRes2.json();
    expect(listData2.messages[0].status).toBe('read');
  });

  // P0-5: Visible Logout and Session Invalidation
  it('P0-5: invalidates server session on logout and rejects subsequent requests', async () => {
    // Verify token is initially valid
    const meRes1 = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${officerAToken}` },
    });
    expect(meRes1.status).toBe(200);

    // Perform logout
    const logoutRes = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${officerAToken}` },
    });
    expect(logoutRes.status).toBe(200);

    // Subsequent authenticated request is rejected with 401
    const meRes2 = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${officerAToken}` },
    });
    expect(meRes2.status).toBe(401);
  });

  // P0-6: Role-Specific Control Panels & Destination Transfer Precedence
  it('P0-6: enforces destination Co-Admin transfer rule and restricts cross-district admin privilege', async () => {
    // 1. Officer A (Lucknow) requests transfer to Varanasi (stn_vns_cantt)
    const transferReq = await app.request('/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({
        destinationDistrictId: 'dist_varanasi',
        destinationStationId: 'stn_vns_cantt',
        reason: 'Family relocation to Varanasi',
        orderReference: 'PHQ-VNS-2026-01',
      }),
    });
    expect(transferReq.status).toBe(200);
    const { transferId } = await transferReq.json();

    // 2. Source District Co-Admin (Lucknow) attempts to approve -> MUST BE FORBIDDEN (403)
    const lkoApproveRes = await app.request('/api/transfers/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lkoCoToken}`,
      },
      body: JSON.stringify({
        transferId,
        action: 'APPROVE',
      }),
    });
    expect(lkoApproveRes.status).toBe(403);

    // 3. Destination District Co-Admin (Varanasi) approves -> SUCCESS (200)
    const vnsApproveRes = await app.request('/api/transfers/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vnsCoToken}`,
      },
      body: JSON.stringify({
        transferId,
        action: 'APPROVE',
      }),
    });
    expect(vnsApproveRes.status).toBe(200);

    // 4. Verify user's district was atomically updated to Varanasi
    const updatedUser = await db
      .prepare('SELECT district_id, station_office_id FROM users WHERE id = ?')
      .bind(officerAId)
      .first<any>();
    expect(updatedUser.district_id).toBe('dist_varanasi');
    expect(updatedUser.station_office_id).toBe('stn_vns_cantt');

    // 5. Co-Admin attempting to manage Co-Admins -> FORBIDDEN (403)
    const coAdminManage = await app.request('/api/admin/coadmins', {
      headers: { Authorization: `Bearer ${vnsCoToken}` },
    });
    expect(coAdminManage.status).toBe(403);

    // 6. Super Admin accessing Co-Admin management -> ALLOWED (200)
    const superCoAdminManage = await app.request('/api/admin/coadmins', {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    expect(superCoAdminManage.status).toBe(200);
  });
});
