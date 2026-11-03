import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { createSession } from '../../apps/api/src/services/auth';

describe('Departmental Notices & Read Receipts Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let superAdminToken: string;
  let lkoCoAdminToken: string;
  let userLkoToken: string;
  let userVnsToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    // Super Admin
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_super_n', '00000001', 'State Super Admin', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9833333331', 'ACTIVE', 'SUPER_ADMIN', 'hash')`
      )
      .run();

    // Lucknow Co-Admin
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_co_lko_n', '00000002', 'LKO Co-Admin', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9811111112', 'ACTIVE', 'DISTRICT_CO_ADMIN', 'hash')`
      )
      .run();

    // User in Lucknow
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_lko_officer', '00101011', 'Lucknow Officer', 'desig_si', 'dist_lucknow', 'stn_lko_hazratganj', '9876500001', 'ACTIVE', 'USER', 'hash')`
      )
      .run();

    // User in Varanasi
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_vns_officer', '00202022', 'Varanasi Officer', 'desig_si', 'dist_varanasi', 'stn_vns_cantt', '9876500002', 'ACTIVE', 'USER', 'hash')`
      )
      .run();

    superAdminToken = (await createSession(db, 'usr_super_n')).token;
    lkoCoAdminToken = (await createSession(db, 'usr_co_lko_n')).token;
    userLkoToken = (await createSession(db, 'usr_lko_officer')).token;
    userVnsToken = (await createSession(db, 'usr_vns_officer')).token;
  });

  it('allows Super Admin to publish statewide notices and orders', async () => {
    const res = await app.request('/api/notices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Statewide High Alert for Upcoming Festival',
        body: 'All districts to enforce enhanced patrolling and vehicle checks.',
        urgency: 'CRITICAL',
        targetScope: 'STATEWIDE',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.noticeId).toBeDefined();

    // Both Lucknow and Varanasi officers receive the statewide notice
    const lkoNotices = await (
      await app.request('/api/notices', {
        headers: { Authorization: `Bearer ${userLkoToken}` },
      })
    ).json();
    expect(lkoNotices.notices.some((n: any) => n.id === data.noticeId)).toBe(true);

    const vnsNotices = await (
      await app.request('/api/notices', {
        headers: { Authorization: `Bearer ${userVnsToken}` },
      })
    ).json();
    expect(vnsNotices.notices.some((n: any) => n.id === data.noticeId)).toBe(true);
  });

  it('allows Co-Admin to publish to own district, but blocks statewide publishing', async () => {
    // 1. Co-Admin tries to publish statewide (FORBIDDEN 403)
    const statewideRes = await app.request('/api/notices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lkoCoAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Statewide Circular attempt by Co-Admin',
        body: 'Testing scope bypass',
        targetScope: 'STATEWIDE',
      }),
    });
    expect(statewideRes.status).toBe(403);

    // 2. Co-Admin publishes to own district (dist_lucknow) -> SUCCESS 200
    const districtRes = await app.request('/api/notices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lkoCoAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Lucknow Traffic Advisory for Gomti Riverfront',
        body: 'Diversion routes planned for Saturday evening.',
        urgency: 'NORMAL',
        targetScope: 'DISTRICT',
        targetDistrictId: 'dist_lucknow',
      }),
    });
    expect(districtRes.status).toBe(200);
    const { noticeId } = await districtRes.json();

    // Lucknow officer sees it
    const lkoNotices = await (
      await app.request('/api/notices', {
        headers: { Authorization: `Bearer ${userLkoToken}` },
      })
    ).json();
    expect(lkoNotices.notices.some((n: any) => n.id === noticeId)).toBe(true);

    // Varanasi officer DOES NOT see it (district scoped)
    const vnsNotices = await (
      await app.request('/api/notices', {
        headers: { Authorization: `Bearer ${userVnsToken}` },
      })
    ).json();
    expect(vnsNotices.notices.some((n: any) => n.id === noticeId)).toBe(false);
  });

  it('records distinct first-read timestamp and formal acknowledgment receipts', async () => {
    // Super Admin publishes notice
    const pubRes = await app.request('/api/notices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Mandatory Cyber Security Awareness Briefing',
        body: 'All officers must complete and acknowledge this briefing.',
        targetScope: 'STATEWIDE',
      }),
    });
    const { noticeId } = await pubRes.json();

    // 1. User opens notice -> First-Read recorded
    const readRes = await app.request(`/api/notices/${noticeId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userLkoToken}` },
    });
    expect(readRes.status).toBe(200);
    const readData = await readRes.json();
    expect(readData.readAt).toBeDefined();

    // 2. User acknowledges notice -> Formal acknowledgment recorded
    const ackRes = await app.request(`/api/notices/${noticeId}/acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userLkoToken}` },
    });
    expect(ackRes.status).toBe(200);
    const ackData = await ackRes.json();
    expect(ackData.acknowledgedAt).toBeDefined();

    // 3. Admin views read report
    const reportRes = await app.request(`/api/notices/${noticeId}/report`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(reportRes.status).toBe(200);
    const reportData = await reportRes.json();
    expect(reportData.report.totalRead).toBe(1);
    expect(reportData.report.totalAcknowledged).toBe(1);
  });

  it('allows notice issuer to edit notice, but forbids unauthorized users', async () => {
    // 1. Co-Admin publishes notice for dist_lucknow
    const pubRes = await app.request('/api/notices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lkoCoAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Original Notice Title',
        body: 'Original Notice Body',
        urgency: 'NORMAL',
        targetScope: 'DISTRICT',
        targetDistrictId: 'dist_lucknow',
      }),
    });
    const { noticeId } = await pubRes.json();

    // 2. Regular user tries to edit -> 403 Forbidden
    const unauthEditRes = await app.request(`/api/notices/${noticeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userLkoToken}`,
      },
      body: JSON.stringify({
        title: 'Malicious Title Edit',
        body: 'Hacked content',
      }),
    });
    expect(unauthEditRes.status).toBe(403);

    // 3. Issuer (Co-Admin) edits notice -> 200 OK
    const editRes = await app.request(`/api/notices/${noticeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lkoCoAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Updated Notice Title By Issuer',
        body: 'Updated Notice Body with critical guidelines.',
        urgency: 'CRITICAL',
      }),
    });
    expect(editRes.status).toBe(200);
    const editData = await editRes.json();
    expect(editData.success).toBe(true);

    // 4. Verify notice in database has updated values
    const checkRes = await app.request('/api/notices', {
      headers: { Authorization: `Bearer ${userLkoToken}` },
    });
    const { notices } = await checkRes.json();
    const updated = notices.find((n: any) => n.id === noticeId);
    expect(updated).toBeDefined();
    expect(updated.title).toBe('Updated Notice Title By Issuer');
    expect(updated.urgency).toBe('CRITICAL');
  });

  it('allows notice issuer to delete notice from database, cascades recipients, and forbids unauthorized deletion', async () => {
    // 1. Co-Admin publishes notice
    const pubRes = await app.request('/api/notices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lkoCoAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Temporary Flash Order to be deleted',
        body: 'This will be deleted soon.',
        urgency: 'URGENT',
        targetScope: 'DISTRICT',
        targetDistrictId: 'dist_lucknow',
      }),
    });
    const { noticeId } = await pubRes.json();

    // 2. User marks it read
    await app.request(`/api/notices/${noticeId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userLkoToken}` },
    });

    // 3. Unauthorized user tries to delete -> 403 Forbidden
    const unauthDelRes = await app.request(`/api/notices/${noticeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userLkoToken}` },
    });
    expect(unauthDelRes.status).toBe(403);

    // 4. Issuer deletes notice -> 200 OK
    const delRes = await app.request(`/api/notices/${noticeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${lkoCoAdminToken}` },
    });
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);

    // 5. Verify notice no longer exists in database
    const verifyNotice = await db.prepare('SELECT * FROM notices WHERE id = ?').bind(noticeId).first();
    expect(verifyNotice).toBeNull();

    // 6. Verify notice receipts are also deleted
    const verifyReceipts = await db.prepare('SELECT * FROM notice_recipients WHERE notice_id = ?').bind(noticeId).all();
    expect(verifyReceipts.results.length).toBe(0);
  });
});
