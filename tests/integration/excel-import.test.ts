import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { createSession } from '../../apps/api/src/services/auth';

describe('Excel Bulk Import, Dry-Run & Rollback Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let superAdminToken: string;
  let lkoCoAdminToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    // Super Admin
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_super_imp', '00000001', 'State Super Admin', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9833333339', 'ACTIVE', 'SUPER_ADMIN', 'hash')`
      )
      .run();

    // Lucknow Co-Admin
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_co_lko_imp', '00000002', 'LKO Co-Admin', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9811111119', 'ACTIVE', 'DISTRICT_CO_ADMIN', 'hash')`
      )
      .run();

    // Existing user to test update and rollback
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_existing_imp', '00888888', 'Existing Officer', 'desig_const', 'dist_lucknow', 'stn_lko_hazratganj', '9888888888', 'ACTIVE', 'USER', 'hash')`
      )
      .run();

    superAdminToken = (await createSession(db, 'usr_super_imp')).token;
    lkoCoAdminToken = (await createSession(db, 'usr_co_lko_imp')).token;
  });

  it('runs dry-run and rejects Devanagari, scientific notation, and forbidden columns', async () => {
    const validHeaders = ['PNO', 'Name', 'Post', 'District', 'Office', 'Phone', 'WhatsApp', 'Email', 'Status', 'Remarks'];
    
    // Test forbidden column
    const badHeadersRes = await app.request('/api/admin/excel/dry-run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        fileName: 'bad_columns.xlsx',
        headers: [...validHeaders, 'Hide_Phone'],
        rows: [{ PNO: '00123456' }],
      }),
    });
    expect(badHeadersRes.status).toBe(422);

    // Test invalid row values (Hindi name, scientific notation PNO)
    const badRowsRes = await app.request('/api/admin/excel/dry-run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        fileName: 'invalid_rows.xlsx',
        headers: validHeaders,
        rows: [
          {
            PNO: '1.23E+07', // Scientific notation
            Name: 'अजय कुमार', // Hindi name
            Post: 'Inspector of Police',
            District: 'Lucknow',
            Office: 'PS Hazratganj',
            Phone: '9876543210',
            Status: 'ACTIVE',
          },
        ],
      }),
    });
    expect(badRowsRes.status).toBe(200);
    const badRowsData = await badRowsRes.json();
    expect(badRowsData.summary.invalidRows).toBe(1);
    expect(badRowsData.allValid).toBe(false);
  });

  it('enforces district scoping during dry-run for District Co-Admin', async () => {
    const validHeaders = ['PNO', 'Name', 'Post', 'District', 'Office', 'Phone', 'WhatsApp', 'Email', 'Status', 'Remarks'];

    // Lucknow Co-Admin tries to import a record for Varanasi
    const res = await app.request('/api/admin/excel/dry-run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lkoCoAdminToken}`,
      },
      body: JSON.stringify({
        fileName: 'cross_district.xlsx',
        headers: validHeaders,
        rows: [
          {
            PNO: '00999999',
            Name: 'Varanasi Bound Officer',
            Post: 'Sub-Inspector of Police',
            District: 'Varanasi', // Different district!
            Office: 'PS Cantt Varanasi',
            Phone: '9899999999',
            Status: 'ACTIVE',
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary.invalidRows).toBe(1);
    expect(data.previewRows[0].errors[0]).toMatch(/Unauthorized District/);
  });

  it('commits valid batch, stores pre-import snapshots, and executes rollback', async () => {
    const validHeaders = ['PNO', 'Name', 'Post', 'District', 'Office', 'Phone', 'WhatsApp', 'Email', 'Status', 'Remarks'];

    // 1. Dry run with 1 new record and 1 update record
    const dryRunRes = await app.request('/api/admin/excel/dry-run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        fileName: 'valid_personnel.xlsx',
        headers: validHeaders,
        rows: [
          // Update existing user (00888888)
          {
            PNO: '00888888',
            Name: 'Updated Officer Name',
            Post: 'Sub-Inspector of Police',
            District: 'Lucknow',
            Office: 'PS Hazratganj',
            Phone: '9888888888',
            Status: 'ACTIVE',
            Remarks: 'Promoted via batch order',
          },
          // New user (00555555)
          {
            PNO: '00555555',
            Name: 'Brand New Recruit',
            Post: 'Constable',
            District: 'Lucknow',
            Office: 'PS Hazratganj',
            Phone: '9855555555',
            Status: 'ACTIVE',
            Remarks: 'Batch 2026 recruit',
          },
        ],
      }),
    });

    const dryRunData = await dryRunRes.json();
    expect(dryRunData.allValid).toBe(true);
    expect(dryRunData.summary.validRows).toBe(2);
    expect(dryRunData.summary.updatedCount).toBe(1);
    expect(dryRunData.summary.createdCount).toBe(1);

    const jobId = dryRunData.jobId;

    // 2. Commit import
    const commitRes = await app.request('/api/admin/excel/commit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        jobId,
        validRows: dryRunData.previewRows,
      }),
    });
    expect(commitRes.status).toBe(200);

    // Verify DB state after commit
    const updatedUser = await db.prepare('SELECT full_name FROM users WHERE pno = ?').bind('00888888').first<any>();
    expect(updatedUser.full_name).toBe('Updated Officer Name');

    const newUser = await db.prepare('SELECT full_name FROM users WHERE pno = ?').bind('00555555').first<any>();
    expect(newUser.full_name).toBe('Brand New Recruit');

    // 3. Rollback the batch
    const rollbackRes = await app.request('/api/admin/excel/rollback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ jobId }),
    });
    expect(rollbackRes.status).toBe(200);

    // 4. Verify DB state after rollback
    // Existing user's name should be restored to 'Existing Officer'
    const restoredUser = await db.prepare('SELECT full_name FROM users WHERE pno = ?').bind('00888888').first<any>();
    expect(restoredUser.full_name).toBe('Existing Officer');

    // Newly imported user should be removed
    const deletedNewUser = await db.prepare('SELECT * FROM users WHERE pno = ?').bind('00555555').first();
    expect(deletedNewUser).toBeNull();
  });
});
