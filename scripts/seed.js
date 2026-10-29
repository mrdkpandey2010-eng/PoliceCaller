import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function seedData() {
  console.log('--- Seeding Synthetic Development Personnel ---');
  const dbPath = path.join(rootDir, 'local_d1.sqlite');
  const db = new DatabaseSync(dbPath);

  const defaultPassword = 'PoliceUser@2026';
  const superPassword = 'SuperAdmin@2026';
  const coPassword = 'CoAdmin@2026';

  const defaultHash = hashPassword(defaultPassword);
  const superHash = hashPassword(superPassword);
  const coHash = hashPassword(coPassword);

  const syntheticUsers = [
    {
      id: 'usr_seed_super',
      pno: '00000001',
      fullName: 'Vikramaditya Rathore',
      designationId: 'desig_dgp',
      districtId: 'dist_lucknow',
      stationOfficeId: 'stn_lko_sp_office',
      mobile: '9800000001',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      hash: superHash,
    },
    {
      id: 'usr_seed_lko_co',
      pno: '00000002',
      fullName: 'Siddharth Mehra',
      designationId: 'desig_asp',
      districtId: 'dist_lucknow',
      stationOfficeId: 'stn_lko_sp_office',
      mobile: '9800000002',
      role: 'DISTRICT_CO_ADMIN',
      status: 'ACTIVE',
      hash: coHash,
    },
    {
      id: 'usr_seed_vns_co',
      pno: '00000003',
      fullName: 'Anuradha Verma',
      designationId: 'desig_asp',
      districtId: 'dist_varanasi',
      stationOfficeId: 'stn_vns_sp_office',
      mobile: '9800000003',
      role: 'DISTRICT_CO_ADMIN',
      status: 'ACTIVE',
      hash: coHash,
    },
    {
      id: 'usr_seed_lko_1',
      pno: '00112233',
      fullName: 'Rajesh Kumar Singh',
      designationId: 'desig_insp',
      districtId: 'dist_lucknow',
      stationOfficeId: 'stn_lko_hazratganj',
      mobile: '9876543210',
      role: 'USER',
      status: 'ACTIVE',
      hash: defaultHash,
    },
    {
      id: 'usr_seed_lko_2',
      pno: '00112234',
      fullName: 'Manoj Tiwari',
      designationId: 'desig_si',
      districtId: 'dist_lucknow',
      stationOfficeId: 'stn_lko_hazratganj',
      mobile: '9876543211',
      role: 'USER',
      status: 'ACTIVE',
      hash: defaultHash,
    },
    {
      id: 'usr_seed_lko_3',
      pno: '00112235',
      fullName: 'Suresh Chandra',
      designationId: 'desig_const',
      districtId: 'dist_lucknow',
      stationOfficeId: 'stn_lko_gomtinagar',
      mobile: '9876543212',
      role: 'USER',
      status: 'ACTIVE',
      hash: defaultHash,
    },
    {
      id: 'usr_seed_vns_1',
      pno: '00223344',
      fullName: 'Kailash Nath Pandey',
      designationId: 'desig_insp',
      districtId: 'dist_varanasi',
      stationOfficeId: 'stn_vns_cantt',
      mobile: '9876543220',
      role: 'USER',
      status: 'ACTIVE',
      hash: defaultHash,
    },
    {
      id: 'usr_seed_vns_2',
      pno: '00223345',
      fullName: 'Pooja Tripathi',
      designationId: 'desig_si',
      districtId: 'dist_varanasi',
      stationOfficeId: 'stn_vns_dashashwamedh',
      mobile: '9876543221',
      role: 'USER',
      status: 'ACTIVE',
      hash: defaultHash,
    },
    {
      id: 'usr_seed_pending_1',
      pno: '00334455',
      fullName: 'Deepak Mishra',
      designationId: 'desig_const',
      districtId: 'dist_lucknow',
      stationOfficeId: 'stn_lko_hazratganj',
      mobile: '9876543300',
      role: 'USER',
      status: 'PENDING',
      hash: defaultHash,
    },
  ];

  const now = new Date().toISOString();
  const insertStmt = db.prepare(
    `INSERT INTO users (id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash, terms_accepted_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1.0', ?, ?)
     ON CONFLICT(pno) DO UPDATE SET full_name = excluded.full_name`
  );

  for (const u of syntheticUsers) {
    insertStmt.run(
      u.id,
      u.pno,
      u.fullName,
      u.designationId,
      u.districtId,
      u.stationOfficeId,
      u.mobile,
      u.status,
      u.role,
      u.hash,
      now,
      now
    );
  }

  console.log(`✓ Seeded ${syntheticUsers.length} synthetic personnel records.`);
  console.log('  Super Admin Login: PNO 00000001 / Password:', superPassword);
  console.log('  Lucknow Co-Admin:  PNO 00000002 / Password:', coPassword);
  console.log('  Varanasi Co-Admin: PNO 00000003 / Password:', coPassword);
  console.log('  Inspector Hazrat:  PNO 00112233 / Password:', defaultPassword);
}

seedData().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
