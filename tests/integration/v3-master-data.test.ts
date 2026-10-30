import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { hashPassword } from '../../apps/api/src/services/auth';

describe('V3 Master Data Management Comprehensive Test Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let superAdminToken: string;
  let coAdminToken: string;
  let userToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    const pwHash = hashPassword('Secret@2026');

    // Seed 1 Super Admin, 1 District Co-Admin (Lucknow), 1 Regular User
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES 
         ('usr_super_1', '00000001', 'DGP Uttar Pradesh', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9800000001', 'ACTIVE', 'SUPER_ADMIN', ?),
         ('usr_co_lko', '00000002', 'ASP Lucknow Co-Admin', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9800000002', 'ACTIVE', 'DISTRICT_CO_ADMIN', ?),
         ('usr_regular', '00112233', 'Constable Ramesh Kumar', 'desig_const', 'dist_lucknow', 'stn_lko_hazratganj', '9876543210', 'ACTIVE', 'USER', ?)`
      )
      .bind(pwHash, pwHash, pwHash)
      .run();

    // Log in all three
    const saRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '00000001', password: 'Secret@2026' }),
    });
    superAdminToken = (await saRes.json()).token;

    const coRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '00000002', password: 'Secret@2026' }),
    });
    coAdminToken = (await coRes.json()).token;

    const uRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pno: '00112233', password: 'Secret@2026' }),
    });
    userToken = (await uRes.json()).token;
  });

  describe('1. RBAC & Strict Super Admin Authorization Gate', () => {
    it('allows SUPER_ADMIN full CRUD and bulk master endpoints', async () => {
      // Super Admin creates a district
      const res = await app.request('/api/masters/districts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          code: 'TESTD',
          name: 'Test Admin District',
          zone: 'Ayodhya Zone',
          range: 'Ayodhya Range',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.districtId).toBe('dist_testd');
    });

    it('rejects DISTRICT_CO_ADMIN and regular USER with 403 Forbidden on all mutation endpoints', async () => {
      // Co-Admin attempt to create district
      const coRes = await app.request('/api/masters/districts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${coAdminToken}`,
        },
        body: JSON.stringify({ code: 'BAD', name: 'Illegal District' }),
      });
      expect(coRes.status).toBe(403);

      // User attempt to create police station
      const uRes = await app.request('/api/masters/stations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ districtId: 'dist_lucknow', name: 'Illegal Thana', type: 'POLICE_STATION' }),
      });
      expect(uRes.status).toBe(403);

      // Co-Admin attempt to run bulk dry run
      const bulkRes = await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${coAdminToken}`,
        },
        body: JSON.stringify({ entityType: 'DISTRICT', rawLines: 'NewDistrict' }),
      });
      expect(bulkRes.status).toBe(403);
    });
  });

  describe('2. Districts: Single Creation, Bulk Paste & Dropdown Verification', () => {
    it('creates multiple districts in one batch and makes them visible in registration endpoints', async () => {
      // Paste 4 fresh districts
      const pasteLines = 'Batch Dist One\nBatch Dist Two\nBatch Dist Three\nBatch Dist Four';
      const dryRunRes = await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'DISTRICT',
          rawLines: pasteLines,
        }),
      });

      expect(dryRunRes.status).toBe(200);
      const dryRunData = await dryRunRes.json();
      expect(dryRunData.summary.validCount).toBe(4);

      // Commit valid rows
      const commitRes = await app.request('/api/masters/bulk/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'DISTRICT',
          rows: dryRunData.previewRows,
        }),
      });

      expect(commitRes.status).toBe(200);
      const commitData = await commitRes.json();
      expect(commitData.createdCount).toBe(4);

      // Verify they appear in public /api/masters/districts (used by registration)
      const listRes = await app.request('/api/masters/districts');
      const listData = await listRes.json();
      const districtNames = listData.districts.map((d: any) => d.name);
      expect(districtNames).toContain('Batch Dist One');
      expect(districtNames).toContain('Batch Dist Two');
      expect(districtNames).toContain('Batch Dist Three');
      expect(districtNames).toContain('Batch Dist Four');
    });
  });

  describe('3. Fast Bulk Entry: 50+ Police Stations & 50+ Offices for Selected District', () => {
    it('associates 50+ pasted police station names to the exact selected district', async () => {
      // Generate 52 distinct station names for Lucknow
      const stationNames: string[] = [];
      for (let i = 1; i <= 52; i++) {
        stationNames.push(`PS Lucknow Station Sector ${i}`);
      }
      const rawText = stationNames.join('\n');

      // 1. Dry run
      const dryRunRes = await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'POLICE_STATION',
          districtId: 'dist_lucknow',
          rawLines: rawText,
        }),
      });

      expect(dryRunRes.status).toBe(200);
      const dryRunData = await dryRunRes.json();
      expect(dryRunData.summary.totalRows).toBe(52);
      expect(dryRunData.summary.validCount).toBe(52);

      // 2. Commit batch
      const commitRes = await app.request('/api/masters/bulk/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'POLICE_STATION',
          districtId: 'dist_lucknow',
          rows: dryRunData.previewRows,
          fileName: 'Lucknow 52 Thanas Batch',
        }),
      });

      expect(commitRes.status).toBe(200);
      const commitData = await commitRes.json();
      expect(commitData.createdCount).toBe(52);

      // 3. Verify dependent endpoint /api/masters/stations?districtId=dist_lucknow
      const stnRes = await app.request('/api/masters/stations?districtId=dist_lucknow&type=POLICE_STATION');
      const stnData = await stnRes.json();
      const names = stnData.stations.map((s: any) => s.name);
      expect(names).toContain('PS Lucknow Station Sector 1');
      expect(names).toContain('PS Lucknow Station Sector 52');
      // Verify all are POLICE_STATION
      expect(stnData.stations.every((s: any) => s.type === 'POLICE_STATION')).toBe(true);
    });

    it('creates 50+ offices with distinct OFFICE classification belonging to district', async () => {
      const officeNames: string[] = [];
      for (let i = 1; i <= 50; i++) {
        officeNames.push(`Special Crime Investigation Unit ${i}`);
      }

      const dryRunRes = await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'OFFICE',
          districtId: 'dist_lucknow',
          rawLines: officeNames.join('\n'),
        }),
      });

      expect(dryRunRes.status).toBe(200);
      const dryRunData = await dryRunRes.json();
      expect(dryRunData.summary.validCount).toBe(50);

      const commitRes = await app.request('/api/masters/bulk/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'OFFICE',
          districtId: 'dist_lucknow',
          rows: dryRunData.previewRows,
        }),
      });

      expect(commitRes.status).toBe(200);
      const commitData = await commitRes.json();
      expect(commitData.createdCount).toBe(50);

      // Query offices
      const offRes = await app.request('/api/masters/stations?districtId=dist_lucknow&type=OFFICE');
      const offData = await offRes.json();
      expect(offData.stations.some((o: any) => o.name === 'Special Crime Investigation Unit 1')).toBe(true);
    });
  });

  describe('4. Designations Bulk Addition & Ordering', () => {
    it('bulk adds designations and confirms sorted rank order', async () => {
      const dryRunRes = await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'DESIGNATION',
          rawLines: 'Special Task Force Chief\nCyber Forensic Expert',
        }),
      });

      expect(dryRunRes.status).toBe(200);
      const dryRunData = await dryRunRes.json();
      expect(dryRunData.summary.validCount).toBe(2);

      const commitRes = await app.request('/api/masters/bulk/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'DESIGNATION',
          rows: dryRunData.previewRows,
        }),
      });

      expect(commitRes.status).toBe(200);
      const desigListRes = await app.request('/api/masters/designations');
      const desigData = await desigListRes.json();
      const names = desigData.designations.map((d: any) => d.name);
      expect(names).toContain('Special Task Force Chief');
      expect(names).toContain('Cyber Forensic Expert');
    });
  });

  describe('5. Error Handling, Devanagari Rejection, Duplicates & Whitespace Normalization', () => {
    it('flags Hindi / Devanagari text, duplicates, and unknown districts with precise row status', async () => {
      const mixedLines = [
        'PS Valid Station Alpha',
        'थाना हजरतगंज लखनऊ', // Hindi name -> INVALID
        'PS Valid Station Alpha', // Duplicate in file
        'PS Hazratganj', // Already exists in seeded DB
      ].join('\n');

      const res = await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'POLICE_STATION',
          districtId: 'dist_lucknow',
          rawLines: mixedLines,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary.totalRows).toBe(4);
      expect(data.summary.validCount).toBe(1);
      expect(data.summary.invalidCount).toBe(1);
      expect(data.summary.duplicateInFileCount).toBe(1);
      expect(data.summary.alreadyExistsCount).toBe(1);

      const hindiRow = data.previewRows.find((r: any) => r.submittedValue.includes('हजरतगंज'));
      expect(hindiRow.status).toBe('INVALID');
      expect(hindiRow.error).toMatch(/English letters/i);

      const dupRow = data.previewRows.find((r: any) => r.status === 'DUPLICATE_IN_FILE');
      expect(dupRow).toBeDefined();

      const existingRow = data.previewRows.find((r: any) => r.status === 'ALREADY_EXISTS');
      expect(existingRow).toBeDefined();
    });

    it('flags unknown district when multi-district file has invalid district name', async () => {
      const rows = [
        { 'District Name or ID': 'NonExistentDistrictName', 'Police Station Name': 'PS Phantom' },
        { 'District Name or ID': 'Lucknow', 'Police Station Name': 'PS Real Thana' },
      ];

      const res = await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'POLICE_STATION',
          rows,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary.unknownDistrictCount).toBe(1);
      expect(data.summary.validCount).toBe(1);
    });
  });

  describe('6. Zero DB Writes During Dry-Run & Atomic Commit', () => {
    it('verifies that dry-run performs absolutely ZERO database writes', async () => {
      const initialCount = (await db.prepare('SELECT count(*) as c FROM districts').first<any>()).c;

      await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'DISTRICT',
          rawLines: 'TestDryRunDistrictOne\nTestDryRunDistrictTwo',
        }),
      });

      const afterDryRunCount = (await db.prepare('SELECT count(*) as c FROM districts').first<any>()).c;
      expect(afterDryRunCount).toBe(initialCount); // Zero rows written!
    });
  });

  describe('7. Safe Rollback Mechanism & Reference Protection', () => {
    it('reverses newly created unreferenced batch cleanly and protects referenced records', async () => {
      // 1. Commit 2 new stations
      const dryRes = await app.request('/api/masters/bulk/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'POLICE_STATION',
          districtId: 'dist_lucknow',
          rawLines: 'PS Rollback Station 1\nPS Rollback Station 2',
        }),
      });
      const dryData = await dryRes.json();

      const commitRes = await app.request('/api/masters/bulk/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          entityType: 'POLICE_STATION',
          districtId: 'dist_lucknow',
          rows: dryData.previewRows,
          fileName: 'Rollback Test Batch',
        }),
      });
      const { jobId } = await commitRes.json();

      // Find created station 1 and assign an active user to it (so it becomes referenced)
      const stn1 = await db.prepare("SELECT id FROM stations_offices WHERE name = 'PS Rollback Station 1'").first<any>();
      await db.prepare("UPDATE users SET station_office_id = ? WHERE id = 'usr_regular'").bind(stn1.id).run();

      // 2. Perform Rollback
      const rollbackRes = await app.request('/api/masters/bulk/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ jobId }),
      });

      expect(rollbackRes.status).toBe(200);
      const rbData = await rollbackRes.json();
      expect(rbData.success).toBe(true);
      expect(rbData.rolledBackCount).toBe(1); // PS Rollback Station 2 deleted
      expect(rbData.protectedCount).toBe(1); // PS Rollback Station 1 protected!

      // Verify Station 1 still exists in DB
      const stn1After = await db.prepare("SELECT id FROM stations_offices WHERE name = 'PS Rollback Station 1'").first<any>();
      expect(stn1After).toBeDefined();

      // Verify Station 2 was deleted
      const stn2After = await db.prepare("SELECT id FROM stations_offices WHERE name = 'PS Rollback Station 2'").first<any>();
      expect(stn2After).toBeNull();
    });
  });

  describe('8. Master Data Activation / Deactivation & Dropdown Hiding', () => {
    it('deactivates a district and ensures it is excluded from public registration dropdown', async () => {
      // Create new district
      const createRes = await app.request('/api/masters/districts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ code: 'TDIS', name: 'Test Deactivation District' }),
      });
      expect(createRes.status).toBe(200);
      const { districtId } = await createRes.json();

      // Verify active
      const activeList = await (await app.request('/api/masters/districts')).json();
      expect(activeList.districts.some((d: any) => d.id === districtId)).toBe(true);

      // Deactivate it
      const toggleRes = await app.request(`/api/masters/districts/${districtId}/toggle-active`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(toggleRes.status).toBe(200);

      // Verify public list excludes inactive district
      const updatedPublicList = await (await app.request('/api/masters/districts')).json();
      expect(updatedPublicList.districts.some((d: any) => d.id === districtId)).toBe(false);

      // But Super Admin can see it with ?all=true
      const superAdminAllList = await (
        await app.request('/api/masters/districts?all=true', {
          headers: { Authorization: `Bearer ${superAdminToken}` },
        })
      ).json();
      const toggled = superAdminAllList.districts.find((d: any) => d.id === districtId);
      expect(toggled).toBeDefined();
      expect(toggled.isActive).toBe(0);
    });
  });
});
