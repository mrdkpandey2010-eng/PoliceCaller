import { describe, it, expect, beforeEach } from 'vitest';
import { LocalD1Database } from '../../apps/api/src/db/d1-adapter';
import { applyMigrations } from '../../apps/api/src/db';
import { createApp } from '../../apps/api/src';
import { hashPassword } from '../../apps/api/src/services/auth';

describe('Auth & Registration Integration Suite', () => {
  let db: LocalD1Database;
  let app: any;

  beforeEach(async () => {
    db = new LocalD1Database(':memory:');
    await applyMigrations(db);
    app = createApp(db);
  });

  it('allows self-registration with valid canonical English data', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pno: '009876543', // String PNO with leading zero (9 digits per V4.6)
        fullName: 'Vikram Aditya Singh',
        designationId: 'desig_const',
        districtId: 'dist_lucknow',
        stationOfficeId: 'stn_lko_hazratganj',
        mobile: '9876543210',
        whatsapp: '9876543210',
        email: 'vikram.singh@uppolice.gov.in',
        password: 'Password@123',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.userId).toBeDefined();

    // Verify record in database preserves leading zero
    const userInDb = await db.prepare('SELECT * FROM users WHERE id = ?').bind(data.userId).first<any>();
    expect(userInDb.pno).toBe('009876543');
    expect(userInDb.status).toBe('PENDING');
  });

  it('rejects registration with Hindi / Devanagari input with structured 422 error', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pno: '009876543',
        fullName: 'विक्रम आदित्य सिंह', // Hindi name
        designationId: 'desig_const',
        districtId: 'dist_lucknow',
        stationOfficeId: 'stn_lko_hazratganj',
        mobile: '9876543210',
        password: 'Password@123',
      }),
    });

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
    const nameError = data.details.find((d: any) => d.path.includes('fullName'));
    expect(nameError.message).toMatch(/Name must be entered in English letters only/);
  });

  it('rejects duplicate PNO registration', async () => {
    const regPayload = {
      pno: '112233445', // 9 digits per V4.6
      fullName: 'Rajesh Sharma',
      designationId: 'desig_si',
      districtId: 'dist_lucknow',
      stationOfficeId: 'stn_lko_hazratganj',
      mobile: '9811223344',
      password: 'Password@123',
    };

    const firstRes = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload),
    });
    expect(firstRes.status).toBe(200);

    const dupRes = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...regPayload, mobile: '9899887766' }),
    });
    expect(dupRes.status).toBe(409);
  });

  it('handles PNO-first login, mandatory terms gate, and logout session revocation', async () => {
    // Seed an approved active user
    const userId = 'usr_test_active';
    const pwHash = hashPassword('MySecretPass@123');
    await db
      .prepare(
        `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash)
         VALUES (?, '005544332', 'Sunil Kumar', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9876500000', 'ACTIVE', 'USER', ?)`
      )
      .bind(userId, pwHash)
      .run();

    // 1. Login
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pno: '005544332',
        password: 'MySecretPass@123',
      }),
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.token).toBeDefined();
    expect(loginData.user.needsTermsAcceptance).toBe(true);

    const token = loginData.token;

    // 2. Accept Terms
    const termsRes = await app.request('/api/auth/terms/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ version: '1.0' }),
    });
    expect(termsRes.status).toBe(200);

    // Verify /api/auth/me shows terms accepted
    const meRes = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.user.needsTermsAcceptance).toBe(false);

    // 3. Logout
    const logoutRes = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.status).toBe(200);

    // Subsequent authenticated request is rejected (session revoked)
    const afterLogoutRes = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(afterLogoutRes.status).toBe(401);
  });
});
