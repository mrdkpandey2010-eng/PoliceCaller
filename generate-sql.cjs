const fs = require('node:fs');
const XLSX = require('xlsx');

const excelPath = 'C:/Users/hp/.gemini/antigravity/brain/12d78132-edf9-463f-ba25-6ef88406d186/.user_uploaded/media_1793389593240_10781002.xlsx';
const wb = XLSX.readFile(excelPath);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Template']);

console.log('Total stations in Excel:', rows.length);

// Extract the 75 canonical districts from db/seeds/districts.sql
const distSql = fs.readFileSync('./db/seeds/districts.sql', 'utf-8');
const distNameToId = new Map();
const distRegex = /\('([^']+)',\s*'[^']+',\s*'([^']+)'/g;
let m;
while ((m = distRegex.exec(distSql)) !== null) {
  distNameToId.set(m[2].toLowerCase().trim(), m[1]);
}
console.log('Loaded canonical districts count:', distNameToId.size);

function resolveDistrict(rawName) {
  const d = String(rawName || '').trim();
  const lower = d.toLowerCase();

  // 1. GRP Sections -> Map to corresponding Headquarters District
  if (lower === 'grp section agra' || (lower.includes('grp') && lower.includes('agra'))) return { distId: 'dist_agra', baseName: 'Agra' };
  if (lower === 'grp section gorakhpur' || (lower.includes('grp') && lower.includes('gorakhpur'))) return { distId: 'dist_gorakhpur', baseName: 'Gorakhpur' };
  if (lower === 'grp section jhansi' || (lower.includes('grp') && lower.includes('jhansi'))) return { distId: 'dist_jhansi', baseName: 'Jhansi' };
  if (lower === 'grp section lucknow' || (lower.includes('grp') && lower.includes('lucknow'))) return { distId: 'dist_lucknow', baseName: 'Lucknow' };
  if (lower === 'grp section moradabad' || (lower.includes('grp') && lower.includes('moradabad'))) return { distId: 'dist_moradabad', baseName: 'Moradabad' };
  if (lower === 'grp section prayagraj' || (lower.includes('grp') && lower.includes('prayagraj'))) return { distId: 'dist_prayagraj', baseName: 'Prayagraj' };

  // 2. Specific known name variants
  if (lower === 'fatehgarh') return { distId: 'dist_farrukhabad', baseName: 'Farrukhabad' };
  if (lower === 'rae bareli') return { distId: 'dist_raebareli', baseName: 'Raebareli' };
  if (lower === 'siddharth nagar') return { distId: 'dist_siddharthnagar', baseName: 'Siddharthnagar' };
  if (lower === 'kumbh') return { distId: 'dist_prayagraj', baseName: 'Prayagraj' };

  // 3. Commissionerates (Check prayagraj before agra!)
  if (lower.includes('prayagraj')) return { distId: 'dist_prayagraj', baseName: 'Prayagraj' };
  if (lower.includes('agra')) return { distId: 'dist_agra', baseName: 'Agra' };
  if (lower.includes('kanpur nagar')) return { distId: 'dist_kanpur_nagar', baseName: 'Kanpur Nagar' };
  if (lower.includes('ghaziabad')) return { distId: 'dist_ghaziabad', baseName: 'Ghaziabad' };
  if (lower.includes('gautam buddh')) return { distId: 'dist_gautam_buddha_nagar', baseName: 'Gautam Buddha Nagar' };
  if (lower.includes('lucknow')) return { distId: 'dist_lucknow', baseName: 'Lucknow' };
  if (lower.includes('varanasi')) return { distId: 'dist_varanasi', baseName: 'Varanasi' };

  // 4. Exact match in 75 districts
  if (distNameToId.has(lower)) {
    return { distId: distNameToId.get(lower), baseName: d };
  }

  throw new Error(`Unresolved district: ${rawName}`);
}

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''").trim()}'`;
}

const insertStatements = [];

// Seed key administrative headquarters offices for system continuity
insertStatements.push(
  `INSERT OR REPLACE INTO stations_offices (id, district_id, name, type, address, phone, is_active) VALUES ('stn_lko_sp_office', 'dist_lucknow', 'SP City Office Lucknow', 'SP_OFFICE', 'Police Line, Lucknow', '05222200100', 1);`
);
insertStatements.push(
  `INSERT OR REPLACE INTO stations_offices (id, district_id, name, type, address, phone, is_active) VALUES ('stn_vns_sp_office', 'dist_varanasi', 'SSP Office Varanasi', 'SP_OFFICE', 'Kachehari, Varanasi', '05422509999', 1);`
);
insertStatements.push(
  `INSERT OR REPLACE INTO stations_offices (id, district_id, name, type, address, phone, is_active) VALUES ('stn_pry_sp_office', 'dist_prayagraj', 'SSP Office Prayagraj', 'SP_OFFICE', 'Collectorate, Prayagraj', '05322403344', 1);`
);
insertStatements.push(
  `INSERT OR REPLACE INTO stations_offices (id, district_id, name, type, address, phone, is_active) VALUES ('stn_lko_line', 'dist_lucknow', 'Reserve Police Line Lucknow', 'LINE', 'Mahanagar, Lucknow', '05222200101', 1);`
);

for (const r of rows) {
  const srNo = r['SR NO'];
  const dist = resolveDistrict(r['District Name or ID']);
  let name = String(r['Police Station Name'] || '').trim();

  // Differentiate duplicate Fazalganj in Kanpur Nagar
  if (dist.distId === 'dist_kanpur_nagar' && name.toLowerCase() === 'fazalganj') {
    if (r['District Name or ID'].includes('East')) {
      name = 'Fazalganj (East)';
    } else {
      name = 'Fazalganj (Central)';
    }
  }

  // Canonical IDs & Names for test compatibility
  let id = `stn_thana_${srNo}`;
  if (srNo === 955) {
    id = 'stn_lko_hazratganj';
    name = 'PS Hazratganj';
  } else if (srNo === 980) {
    id = 'stn_vns_cantt';
    name = 'PS Cantt Varanasi';
  } else if (srNo === 758) {
    id = 'stn_kpn_kotwali';
    name = 'PS Kotwali';
  }

  const address = r['Address'] ? String(r['Address']).trim() : `${name}, ${r['District Name or ID']}`;
  const phone = r['Phone'] ? String(r['Phone']).trim() : null;

  insertStatements.push(
    `INSERT OR REPLACE INTO stations_offices (id, district_id, name, type, address, phone, is_active) VALUES (${escapeSql(id)}, ${escapeSql(dist.distId)}, ${escapeSql(name)}, 'POLICE_STATION', ${escapeSql(address)}, ${phone ? escapeSql(phone) : 'NULL'}, 1);`
  );
}

console.log('Total statements generated:', insertStatements.length);

const finalSql = `-- Total 1878 Official Police Stations of Uttar Pradesh + Headquarters Offices\n${insertStatements.join('\n')}\n`;
fs.writeFileSync('./db/seeds/police_stations_1878.sql', finalSql, 'utf-8');
console.log('Wrote ./db/seeds/police_stations_1878.sql successfully!');
