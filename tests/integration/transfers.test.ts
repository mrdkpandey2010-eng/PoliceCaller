import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { createSession } from '../../apps/api/src/services/auth';

describe('Transfers & RBAC Approval Precedence Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let userToken: string;
  let lkoCoAdminToken: string; // Source district Co-Admin
  let vnsCoAdminToken: string; // Destination district Co-Admin
  let superAdminToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    // 1. Regular User currently in Lucknow Hazratganj
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_transfer_applicant', '00778899', 'Dharmendra Yadav', 'desig_si', 'dist_lucknow', 'stn_lko_hazratganj', '9876512345', 'ACTIVE', 'USER', 'hash')`
      )
      .run();

    // 2. Lucknow Co-Admin (Source district)
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_co_lko', '00000002', 'LKO Co-Admin', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9811111111', 'ACTIVE', 'DISTRICT_CO_ADMIN', 'hash')`
      )
      .run();

    // 3. Varanasi Co-Admin (Destination district)
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_co_vns', '00000003', 'VNS Co-Admin', 'desig_asp', 'dist_varanasi', 'stn_vns_sp_office', '9822222222', 'ACTIVE', 'DISTRICT_CO_ADMIN', 'hash')`
      )
      .run();

    // 4. Super Admin
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_super_admin', '00000001', 'State Super Admin', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9833333333', 'ACTIVE', 'SUPER_ADMIN', 'hash')`
      )
      .run();

    userToken = (await createSession(db, 'usr_transfer_applicant')).token;
    lkoCoAdminToken = (await createSession(db, 'usr_co_lko')).token;
    vnsCoAdminToken = (await createSession(db, 'usr_co_vns')).token;
    superAdminToken = (await createSession(db, 'usr_super_admin')).token;
  });

  it('allows user to request transfer to destination district and station', async () => {
    const res = await app.request('/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        destinationDistrictId: 'dist_varanasi',
        destinationStationId: 'stn_vns_cantt',
        reason: 'Personal and family health reasons',
        orderReference: 'DGO-2026/8941',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.transferId).toBeDefined();

    const transferInDb = await db.prepare('SELECT * FROM transfer_requests WHERE id = ?').bind(data.transferId).first<any>();
    expect(transferInDb.status).toBe('PENDING');
    expect(transferInDb.source_district_id).toBe('dist_lucknow');
    expect(transferInDb.destination_district_id).toBe('dist_varanasi');
  });

  it('strictly blocks Source District Co-Admin from approving transfer (Transfer Precedence Rule)', async () => {
    // 1. Create transfer request
    const createRes = await app.request('/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        destinationDistrictId: 'dist_varanasi',
        destinationStationId: 'stn_vns_cantt',
        reason: 'Administrative rotation request',
      }),
    });
    const { transferId } = await createRes.json();

    // 2. Source District Co-Admin (Lucknow) tries to approve
    const reviewRes = await app.request('/api/transfers/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lkoCoAdminToken}`,
      },
      body: JSON.stringify({
        transferId,
        action: 'APPROVE',
      }),
    });

    // Must be FORBIDDEN 403!
    expect(reviewRes.status).toBe(403);
    const errorData = await reviewRes.json();
    expect(errorData.error).toMatch(/Destination District Co-Admin can approve/);

    // Verify user posting did NOT change
    const userInDb = await db.prepare('SELECT district_id FROM users WHERE id = ?').bind('usr_transfer_applicant').first<any>();
    expect(userInDb.district_id).toBe('dist_lucknow');
  });

  it('allows Destination District Co-Admin to approve transfer and updates posting atomically', async () => {
    // 1. Create transfer request
    const createRes = await app.request('/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        destinationDistrictId: 'dist_varanasi',
        destinationStationId: 'stn_vns_cantt',
        reason: 'Authorized posting change',
      }),
    });
    const { transferId } = await createRes.json();

    // 2. Destination District Co-Admin (Varanasi) approves
    const reviewRes = await app.request('/api/transfers/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vnsCoAdminToken}`,
      },
      body: JSON.stringify({
        transferId,
        action: 'APPROVE',
      }),
    });

    expect(reviewRes.status).toBe(200);
    const data = await reviewRes.json();
    expect(data.status).toBe('APPROVED');

    // 3. Verify user's posting updated atomically in users table
    const userInDb = await db.prepare('SELECT district_id, station_office_id FROM users WHERE id = ?').bind('usr_transfer_applicant').first<any>();
    expect(userInDb.district_id).toBe('dist_varanasi');
    expect(userInDb.station_office_id).toBe('stn_vns_cantt');
  });

  it('allows Super Admin to approve transfers statewide', async () => {
    // 1. Create transfer request
    const createRes = await app.request('/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        destinationDistrictId: 'dist_varanasi',
        destinationStationId: 'stn_vns_cantt',
        reason: 'State headquarters order',
      }),
    });
    const { transferId } = await createRes.json();

    // 2. Super Admin approves
    const reviewRes = await app.request('/api/transfers/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        transferId,
        action: 'APPROVE',
      }),
    });

    expect(reviewRes.status).toBe(200);
    const userInDb = await db.prepare('SELECT district_id FROM users WHERE id = ?').bind('usr_transfer_applicant').first<any>();
    expect(userInDb.district_id).toBe('dist_varanasi');
  });
});
