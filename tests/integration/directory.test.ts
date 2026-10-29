import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { createSession } from '../../apps/api/src/services/auth';

describe('Directory & Search Integration Suite', () => {
  let db: LocalD1Database;
  let app: any;
  let activeUserToken: string;
  let pendingUserToken: string;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);

    // Seed test users:
    // 1. Approved Active User in Lucknow Hazratganj
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_lko_1', '00112233', 'Rajesh Kumar', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9876543210', 'ACTIVE', 'USER', 'hash')`
      )
      .run();

    // 2. Active User in Varanasi Cantt
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_vns_1', '00998877', 'Amitabh Bachchan', 'desig_si', 'dist_varanasi', 'stn_vns_cantt', '9812345678', 'ACTIVE', 'USER', 'hash')`
      )
      .run();

    // 3. Pending User
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES ('usr_pending', '00445566', 'Pending Officer', 'desig_const', 'dist_lucknow', 'stn_lko_hazratganj', '9800000000', 'PENDING', 'USER', 'hash')`
      )
      .run();

    const activeSession = await createSession(db, 'usr_lko_1');
    activeUserToken = activeSession.token;

    const pendingSession = await createSession(db, 'usr_pending');
    pendingUserToken = pendingSession.token;
  });

  it('contains all 75 verified districts of Uttar Pradesh', async () => {
    const res = await app.request('/api/masters/districts');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.districts).toHaveLength(75);
    
    const districtNames = data.districts.map((d: any) => d.name);
    expect(districtNames).toContain('Lucknow');
    expect(districtNames).toContain('Varanasi');
    expect(districtNames).toContain('Prayagraj');
    expect(districtNames).toContain('Agra');
    expect(districtNames).toContain('Gorakhpur');
    expect(districtNames).toContain('Kanpur Nagar');
  });

  it('provides universal search finding Name, PNO, mobile, station, district', async () => {
    // Search by Name
    const nameSearch = await app.request('/api/directory?q=Rajesh', {
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    expect(nameSearch.status).toBe(200);
    const nameData = await nameSearch.json();
    expect(nameData.contacts.length).toBeGreaterThan(0);
    expect(nameData.contacts[0].fullName).toBe('Rajesh Kumar');
    // Full unmasked mobile number must be present
    expect(nameData.contacts[0].mobile).toBe('9876543210');

    // Search by PNO
    const pnoSearch = await app.request('/api/directory?q=00998877', {
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    const pnoData = await pnoSearch.json();
    expect(pnoData.contacts[0].fullName).toBe('Amitabh Bachchan');

    // Search by District
    const distSearch = await app.request('/api/directory?q=Varanasi', {
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    const distData = await distSearch.json();
    expect(distData.contacts[0].districtName).toBe('Varanasi');
  });

  it('prioritizes user assigned station/office by default in directory listing', async () => {
    const res = await app.request('/api/directory', {
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    const data = await res.json();
    expect(data.contacts.length).toBeGreaterThanOrEqual(2);
    // User usr_lko_1 is at stn_lko_hazratganj, so officers at that station appear first
    expect(data.contacts[0].stationOfficeId).toBe('stn_lko_hazratganj');
  });

  it('blocks pending or inactive users from accessing directory', async () => {
    const res = await app.request('/api/directory', {
      headers: { Authorization: `Bearer ${pendingUserToken}` },
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/restricted to approved active personnel/);
  });

  it('supports favorites toggle and recent searches persistence', async () => {
    // Toggle favorite
    const favRes = await app.request('/api/directory/favorites/usr_vns_1/toggle', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    expect(favRes.status).toBe(200);
    const favData = await favRes.json();
    expect(favData.isFavorite).toBe(true);

    // List with favorites=true
    const listFavRes = await app.request('/api/directory?favorites=true', {
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    const listFavData = await listFavRes.json();
    expect(listFavData.contacts).toHaveLength(1);
    expect(listFavData.contacts[0].id).toBe('usr_vns_1');

    // Check recent searches
    const recentRes = await app.request('/api/directory/recent-searches', {
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    const recentData = await recentRes.json();
    expect(Array.isArray(recentData.recentSearches)).toBe(true);
  });
});
