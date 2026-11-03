import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { createSession } from '../../apps/api/src/services/auth';
import { cleanName, parseThanaDetailsHtml } from '../../apps/api/src/routes/external-portal';

describe('UP Police Portal Hybrid Integration Test Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let superAdminToken: string;
  let lkoCoAdminToken: string;
  let vnsCoAdminToken: string;
  let regularUserToken: string;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    // 1. Super Admin (using valid desig_dgp)
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_super_admin', '00000001', 'State Super Admin', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9454400001', 'ACTIVE', 'SUPER_ADMIN', 'hash')`
      )
      .run();

    // 2. Lucknow Co-Admin (using valid desig_insp)
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_coadmin_lko', '00000002', 'Lucknow Co Admin', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9454400002', 'ACTIVE', 'DISTRICT_CO_ADMIN', 'hash')`
      )
      .run();

    // 3. Varanasi Co-Admin (using valid desig_insp)
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_coadmin_vns', '00000003', 'Varanasi Co Admin', 'desig_insp', 'dist_varanasi', 'stn_vns_cantt', '9454400003', 'ACTIVE', 'DISTRICT_CO_ADMIN', 'hash')`
      )
      .run();

    // 4. Regular User (using valid desig_const)
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_regular_user', '00000004', 'Constable Ram', 'desig_const', 'dist_lucknow', 'stn_lko_hazratganj', '9454400004', 'ACTIVE', 'USER', 'hash')`
      )
      .run();

    const s1 = await createSession(db, 'usr_super_admin');
    superAdminToken = s1.token;

    const s2 = await createSession(db, 'usr_coadmin_lko');
    lkoCoAdminToken = s2.token;

    const s3 = await createSession(db, 'usr_coadmin_vns');
    vnsCoAdminToken = s3.token;

    const s4 = await createSession(db, 'usr_regular_user');
    regularUserToken = s4.token;

    // Mock global fetch for reliable, fast portal responses
    globalThis.fetch = vi.fn().mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('districtHandler.ashx')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            districts: [{ d: 'LUCKNOW CITY (COMMISSIONERATE)' }, { d: 'VARANASI NAGAR (COMMISSIONERATE)' }],
            districtsCode: [{ c: 76 }, { c: 78 }],
          }),
        };
      }
      if (urlStr.includes('thanaHandler.ashx')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            districts: [{ d: 'Hazratganj' }, { d: 'Aliganj' }, { d: 'Cantt' }],
            districtsCode: [{ c: 101 }, { c: 102 }, { c: 201 }],
          }),
        };
      }
      if (urlStr.includes('ThanaDetails')) {
        return {
          ok: true,
          status: 200,
          text: async () => `
            <table>
              <tr>
                <th>Photograph</th>
                <th>Name of SHO/SO</th>
                <th>Designation</th>
                <th>Mobile Number</th>
                <th>Other Number</th>
                <th>Email Id</th>
              </tr>
              <tr>
                <td><img src="photo.jpg" alt="" /></td>
                <td>MR. ANIL KUMAR</td>
                <td>INSPECTOR</td>
                <td>9454403844</td>
                <td>0522-223344</td>
                <td>sho-hazratganj@up.gov.in</td>
              </tr>
            </table>
            <table>
              <tr><td>Police District</td><td>LUCKNOW CITY (COMMISSIONERATE)</td></tr>
              <tr><td>Name of Police Station</td><td>Hazratganj</td></tr>
              <tr><td>Jurisdiction (क्षेत्र)</td><td>Hazratganj Market, Vidhan Sabha</td></tr>
              <tr><td>Name of Circle</td><td>Circle Hazratganj</td></tr>
              <tr><td>Name of CO/ ACP</td><td>MR. VIKRAM SINGH</td></tr>
              <tr><td>Contact No (CUG)</td><td>9454400111</td></tr>
              <tr><td>Email CO/ ACP</td><td>acp-hazratganj@up.gov.in</td></tr>
            </table>
          `,
        };
      }
      return { ok: false, status: 404, text: async () => 'Not found' };
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Parser & Name Normalization Engine', () => {
    it('normalizes police station names by cleaning affixes and variants', () => {
      expect(cleanName('PS Hazratganj')).toBe('hazratganj');
      expect(cleanName('Thana Hazaratganj')).toBe('hazratganj');
      expect(cleanName('Police Station Alambagh')).toBe('alambagh');
      expect(cleanName('Kotwali Cantt.')).toBe('cantt');
      expect(cleanName('Cantt Chhawani')).toBe('cantt');
      expect(cleanName('Police Station P.G.I.')).toBe('pgi');
      expect(cleanName('Bakshi Ka Talab B.T.K.')).toBe('bakshikatalab');
    });

    it('correctly parses ThanaDetails HTML into structured JSON', () => {
      const sampleHtml = `
        <table>
          <tr>
            <th>Photograph</th>
            <th>Name of SHO/SO</th>
            <th>Designation</th>
            <th>Mobile Number</th>
            <th>Other Number</th>
            <th>Email Id</th>
          </tr>
          <tr>
            <td><img src="photo.jpg" alt="" /></td>
            <td>MR. ANIL KUMAR</td>
            <td>INSPECTOR</td>
            <td>9454403844</td>
            <td>0522-223344</td>
            <td>sho-hazratganj@up.gov.in</td>
          </tr>
        </table>
        <table>
          <tr><td>Police District</td><td>LUCKNOW CITY (COMMISSIONERATE)</td></tr>
          <tr><td>Name of Police Station</td><td>Hazratganj, Lucknow, UP 226001</td></tr>
          <tr><td>Jurisdiction (क्षेत्र)</td><td>Hazratganj market, Raj Bhavan, Vidhan Sabha, Park Road</td></tr>
          <tr><td>Name of Circle</td><td>Circle Hazratganj</td></tr>
          <tr><td>Name of CO/ ACP</td><td>MR. VIKRAM SINGH</td></tr>
          <tr><td>Contact No (CUG)</td><td>9454400111</td></tr>
          <tr><td>Email CO/ ACP</td><td>acp-hazratganj@up.gov.in</td></tr>
        </table>
      `;

      const result = parseThanaDetailsHtml(sampleHtml);
      expect(result.shoName).toBe('MR. ANIL KUMAR');
      expect(result.shoDesignation).toBe('INSPECTOR');
      expect(result.shoCug).toBe('9454403844');
      expect(result.landline).toBe('0522-223344');
      expect(result.shoEmail).toBe('sho-hazratganj@up.gov.in');
      expect(result.district).toBe('LUCKNOW CITY (COMMISSIONERATE)');
      expect(result.coName).toBe('MR. VIKRAM SINGH');
      expect(result.coCug).toBe('9454400111');
      expect(result.coEmail).toBe('acp-hazratganj@up.gov.in');
      expect(result.jurisdiction).toContain('Vidhan Sabha');
    });
  });

  describe('Live Thana Info Endpoint', () => {
    it('returns parsed live data from UP Police portal for verified police station', async () => {
      const res = await app.request('/api/external/uppolice/thana-details?stationId=stn_lko_hazratganj', {
        headers: { Authorization: `Bearer ${regularUserToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isOffice).toBe(false);
      expect(data.source).toBe('UP_POLICE_OFFICIAL_PORTAL');
      expect(data.liveData.shoName).toBe('MR. ANIL KUMAR');
      expect(data.liveData.shoCug).toBe('9454403844');
      expect(data.liveData.coName).toBe('MR. VIKRAM SINGH');
    });

    it('returns isOffice: true for SP Office and never calls portal for non-police-stations', async () => {
      const res = await app.request('/api/external/uppolice/thana-details?stationId=stn_lko_sp_office', {
        headers: { Authorization: `Bearer ${regularUserToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isOffice).toBe(true);
      expect(data.message).toContain('विभागीय कार्यालय');
    });
  });

  describe('Scoped Sync & RBAC Permissions', () => {
    it('rejects regular users from initiating sync (403 Forbidden)', async () => {
      const res = await app.request('/api/external/uppolice/sync-district', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regularUserToken}`,
        },
        body: JSON.stringify({ districtId: 'dist_lucknow' }),
      });

      expect(res.status).toBe(403);
    });

    it('rejects District Co-Admin from syncing a different district (403 Forbidden)', async () => {
      // Lucknow Co-Admin trying to sync Varanasi
      const res = await app.request('/api/external/uppolice/sync-district', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lkoCoAdminToken}`,
        },
        body: JSON.stringify({ districtId: 'dist_varanasi' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('assigned district');
    });

    it('allows District Co-Admin to sync their own district with dryRun: true without modifying DB', async () => {
      const res = await app.request('/api/external/uppolice/sync-district', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lkoCoAdminToken}`,
        },
        body: JSON.stringify({ districtId: 'dist_lucknow', dryRun: true }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.dryRun).toBe(true);
      expect(data.matchedCount).toBeGreaterThanOrEqual(1);

      // Verify DB phone has NOT changed during dry run
      const stn = await db
        .prepare('SELECT phone FROM stations_offices WHERE id = ?')
        .bind('stn_lko_hazratganj')
        .first<any>();
      expect(stn.phone).not.toBe('9454403844');
    });

    it('updates verified police station CUG number when dryRun: false and preserves offices', async () => {
      const initialOffice = await db
        .prepare('SELECT phone FROM stations_offices WHERE id = ?')
        .bind('stn_lko_sp_office')
        .first<any>();

      const res = await app.request('/api/external/uppolice/sync-district', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lkoCoAdminToken}`,
        },
        body: JSON.stringify({ districtId: 'dist_lucknow', dryRun: false }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.dryRun).toBe(false);

      // Verify station phone was updated to the official portal CUG
      const stnAfter = await db
        .prepare('SELECT phone FROM stations_offices WHERE id = ?')
        .bind('stn_lko_hazratganj')
        .first<any>();
      expect(stnAfter.phone).toBe('9454403844');

      // Verify SP office was NOT modified at all
      const officeAfter = await db
        .prepare('SELECT phone FROM stations_offices WHERE id = ?')
        .bind('stn_lko_sp_office')
        .first<any>();
      expect(officeAfter.phone).toBe(initialOffice.phone);
    });
  });
});
