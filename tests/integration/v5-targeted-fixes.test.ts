import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { hashPassword } from '../../apps/api/src/services/auth';

describe('V5 Targeted Fixes Comprehensive Integration Test Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let superAdminToken: string;
  let coAdminLkoToken: string;
  let coAdminKpnToken: string;
  let userAToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    const pwHash = hashPassword('SecurePass@2026');

    // Seed 1 Super Admin, 2 District Co-Admins, 1 regular user
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES 
         ('usr_sa', '0000000001', 'DGP Vikramaditya Rathore', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9800000001', 'ACTIVE', 'SUPER_ADMIN', ?),
         ('usr_co_lko', '0000000002', 'ASP Lucknow CoAdmin', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9800000002', 'ACTIVE', 'DISTRICT_CO_ADMIN', ?),
         ('usr_co_kpn', '0000000005', 'ASP Kanpur CoAdmin', 'desig_asp', 'dist_kanpur_nagar', 'stn_kpn_kotwali', '9800000005', 'ACTIVE', 'DISTRICT_CO_ADMIN', ?),
         ('usr_a', '1000000003', 'Inspector User A', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9811111111', 'ACTIVE', 'USER', ?)`
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

    const uaRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '1000000003', password: 'SecurePass@2026' }),
    });
    userAToken = (await uaRes.json()).token;
  });

  // =========================================================================
  // Requirement 1: Directory Pagination (Max 100 per page, max 3 pages)
  // =========================================================================
  describe('Requirement 1: Directory Pagination Limits', () => {
    it('clamps personnel directory limit to 100 and totalPages to max 3', async () => {
      const res = await app.request('/api/directory?limit=250&page=1', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.limit).toBe(100);
      expect(data.totalPages).toBeLessThanOrEqual(3);
      expect(data.contacts.length).toBeLessThanOrEqual(100);
    });

    it('clamps stations/offices directory limit to 100 and totalPages to max 3', async () => {
      const res = await app.request('/api/directory/stations-offices?limit=500&page=1', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.limit).toBe(100);
      expect(data.totalPages).toBeLessThanOrEqual(3);
      expect(data.stationsOffices.length).toBeLessThanOrEqual(100);
    });
  });

  // =========================================================================
  // Requirement 2: Co-Admins Search Page Limit and District Filtering
  // =========================================================================
  describe('Requirement 2: Co-Admins Search Scope and Limit', () => {
    it('limits co-admins to maximum 8 cards when no district is filtered', async () => {
      const res = await app.request('/api/directory/co-admins', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.coAdmins)).toBe(true);
      expect(data.coAdmins.length).toBeLessThanOrEqual(8);
    });

    it('strictly returns only the selected district co-admin when filtered by district', async () => {
      const res = await app.request('/api/directory/co-admins?districtId=dist_kanpur_nagar', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.coAdmins.length).toBe(1);
      expect(data.coAdmins[0].pno).toBe('0000000005');
      expect(data.coAdmins[0].districtId).toBe('dist_kanpur_nagar');
    });
  });

  // =========================================================================
  // Requirement 3: Super Admin Privacy & Headquarters Level Fixation
  // =========================================================================
  describe('Requirement 3: Super Admin Privacy & HQ Posting', () => {
    it('hides Super Admin from general directory searches', async () => {
      const res = await app.request('/api/directory?q=Vikramaditya', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      const foundSa = data.contacts.some((c: any) => c.fullName.includes('Vikramaditya') || c.pno === '0000000001');
      expect(foundSa).toBe(false);
    });

    it('hides Super Admin from co-admins directory listing', async () => {
      const res = await app.request('/api/directory/co-admins', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      const foundSa = data.coAdmins.some((c: any) => c.pno === '0000000001');
      expect(foundSa).toBe(false);
    });

    it('hides Super Admin from District Co-Admin personnel records in command console', async () => {
      const res = await app.request('/api/admin/users', {
        headers: { Authorization: `Bearer ${coAdminLkoToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      const foundSa = data.users.some((u: any) => u.pno === '0000000001' || u.role === 'SUPER_ADMIN');
      expect(foundSa).toBe(false);
    });

    it('strictly blocks Super Admin from submitting transfer requests (fixed at State HQ)', async () => {
      const res = await app.request('/api/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinationDistrictId: 'dist_kanpur_nagar',
          destinationStationId: 'stn_kpn_kotwali',
          reason: 'Routine Headquarters Transfer Request',
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Super Admin posting is permanent at State Headquarters level');
    });
  });

  // =========================================================================
  // Requirement 4: Transfer Review Clean Queue (No completed logs)
  // =========================================================================
  describe('Requirement 4: Transfer Review Clean Queue', () => {
    it('returns only pending transfers when status=PENDING filter is applied and removes completed items', async () => {
      // 1. User A creates transfer
      const createRes = await app.request('/api/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinationDistrictId: 'dist_kanpur_nagar',
          destinationStationId: 'stn_kpn_kotwali',
          reason: 'Routine administrative transfer',
        }),
      });
      expect(createRes.status).toBe(200);
      const { transferId } = await createRes.json();

      // 2. Co-Admin queries pending queue
      const pendingRes = await app.request('/api/transfers?status=PENDING', {
        headers: { Authorization: `Bearer ${coAdminKpnToken}` },
      });
      expect(pendingRes.status).toBe(200);
      const pendingData = await pendingRes.json();
      expect(pendingData.transfers.some((t: any) => t.id === transferId && t.status === 'PENDING')).toBe(true);

      // 3. Co-Admin approves transfer
      const reviewRes = await app.request('/api/transfers/review', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${coAdminKpnToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transferId,
          action: 'APPROVE',
        }),
      });
      expect(reviewRes.status).toBe(200);

      // 4. Query pending review queue again -> Transfer is cleanly removed from queue
      const cleanQueueRes = await app.request('/api/transfers?status=PENDING', {
        headers: { Authorization: `Bearer ${coAdminKpnToken}` },
      });
      expect(cleanQueueRes.status).toBe(200);
      const cleanData = await cleanQueueRes.json();
      expect(cleanData.transfers.some((t: any) => t.id === transferId)).toBe(false);
    });
  });

  // =========================================================================
  // Requirement 5: Excel Bulk Import Toggle Control for Super Admin
  // =========================================================================
  describe('Requirement 5: Excel Bulk Import Toggle Control', () => {
    it('allows Super Admin to view and toggle Co-Admin Excel Bulk Import setting', async () => {
      // 1. Get initial setting
      const getRes = await app.request('/api/admin/settings/coadmin-excel-import', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(getRes.status).toBe(200);
      const initial = await getRes.json();
      expect(typeof initial.enabled).toBe('boolean');

      // 2. Disable Co-Admin Excel import
      const disableRes = await app.request('/api/admin/settings/coadmin-excel-import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: false }),
      });
      expect(disableRes.status).toBe(200);
      const disabledData = await disableRes.json();
      expect(disabledData.enabled).toBe(false);

      // 3. Co-Admin tries to dry-run Excel import -> Blocked with 403 Forbidden
      const dryRunRes = await app.request('/api/admin/excel/dry-run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          headers: ['PNO', 'Name', 'Post', 'District', 'Office', 'Phone', 'WhatsApp', 'Email', 'Status', 'Remarks'],
          rows: [
            {
              PNO: '9999999991',
              Name: 'Constable Test',
              Post: 'Constable',
              District: 'Lucknow',
              Office: 'Hazratganj',
              Phone: '9899999991',
            },
          ],
        }),
      });
      expect(dryRunRes.status).toBe(403);
      const dryRunErr = await dryRunRes.json();
      expect(dryRunErr.error).toContain('disabled for District Co-Admins by Super Admin');

      // 4. Super Admin re-enables Excel import
      const enableRes = await app.request('/api/admin/settings/coadmin-excel-import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: true }),
      });
      expect(enableRes.status).toBe(200);
      const enabledData = await enableRes.json();
      expect(enabledData.enabled).toBe(true);

      // 5. Co-Admin can now dry-run Excel import
      const allowedRes = await app.request('/api/admin/excel/dry-run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          headers: ['PNO', 'Name', 'Post', 'District', 'Office', 'Phone', 'WhatsApp', 'Email', 'Status', 'Remarks'],
          rows: [
            {
              PNO: '9999999991',
              Name: 'Constable Test',
              Post: 'Constable',
              District: 'Lucknow',
              Office: 'Hazratganj',
              Phone: '9899999991',
            },
          ],
        }),
      });
      expect(allowedRes.status).toBe(200);
    });

    it('strictly forbids District Co-Admin or regular users from changing Excel Bulk Import toggle', async () => {
      const coRes = await app.request('/api/admin/settings/coadmin-excel-import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${coAdminLkoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: true }),
      });
      expect(coRes.status).toBe(403);

      const userRes = await app.request('/api/admin/settings/coadmin-excel-import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userAToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: true }),
      });
      expect(userRes.status).toBe(403);
    });
  });
});
