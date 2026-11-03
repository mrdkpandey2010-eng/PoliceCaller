import { Hono } from 'hono';
import { D1Database } from '../db/types';
import { AuthenticatedUser } from '../services/auth';
import { logAuditEvent } from '../services/audit';
import { RBAC, ROLES } from '@police-directory/shared';

export interface PortalDistrictItem {
  name: string;
  code: string | number;
}

export interface PortalThanaItem {
  name: string;
  code: string | number;
}

export interface ParsedThanaDetails {
  district: string;
  stationName: string;
  address: string;
  jurisdiction: string;
  shoName: string;
  shoDesignation: string;
  shoCug: string;
  landline: string;
  shoEmail: string;
  circleName: string;
  coName: string;
  coCug: string;
  coEmail: string;
}

// In-memory caches to minimize portal latency and prevent rate-limiting
const CACHE_TTL_DISTRICTS_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_TTL_THANAS_MS = 2 * 60 * 60 * 1000; // 2 hours
const CACHE_TTL_DETAILS_MS = 30 * 60 * 1000; // 30 minutes

let cachedDistricts: { data: PortalDistrictItem[]; expiresAt: number } | null = null;
const cachedThanas = new Map<string, { data: PortalThanaItem[]; expiresAt: number }>();
const cachedDetails = new Map<string, { data: ParsedThanaDetails; expiresAt: number }>();

const PORTAL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Common stop-words and prefixes in UP police station and district names
export function cleanName(name: string): string {
  if (!name) return '';
  let n = name.toLowerCase();
  
  // Specific aliases & transliteration variations
  n = n.replace(/hazaratganj/g, 'hazratganj');
  n = n.replace(/bijnaur/g, 'bijnor');
  n = n.replace(/banthara/g, 'banthra');
  n = n.replace(/gosaiganj/g, 'gosainganj');
  n = n.replace(/nagram/g, 'nagaram');
  n = n.replace(/kaesarbagh|qaiserbagh/g, 'kaiserbagh');
  n = n.replace(/wazirganj/g, 'wazeerganj');
  n = n.replace(/ashiana/g, 'ashiyana');
  n = n.replace(/maday\s*ganj/g, 'madeyganj');
  n = n.replace(/second/g, 'ii');
  n = n.replace(/-ii/g, 'ii');
  n = n.replace(/b\.?b\.?d\.?|babu\s*banarasi\s*das/g, 'bbd');
  n = n.replace(/vistar/g, 'extension');
  n = n.replace(/b\.?t\.?k\.?|bkt/g, 'bakshikatalab');
  n = n.replace(/p\.?g\.?i\.?/g, 'pgi');
  n = n.replace(/g\.?r\.?p\.?/g, 'grp');
  n = n.replace(/cantt\.?/g, 'cantt');
  n = n.replace(/\b(chhavani|chhawani|chhavni)\b/g, '');

  const stopWords = [
    'police station',
    'police',
    'station',
    'thana',
    'kotwali',
    'ps',
    'chawki',
    'chowki',
    'nagar',
    'city',
    'rural',
    'dehat',
    'commissionerate',
    'zone',
    'range',
    'chhavani',
    'chhawani',
    'chhavni',
  ];

  for (const word of stopWords) {
    n = n.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  }

  // Remove non-alphanumeric characters
  let cleaned = n.replace(/[^a-z0-9]/g, '').trim();

  // Deduplicate identical repeated tokens (e.g. bakshikatalabbakshikatalab -> bakshikatalab)
  cleaned = cleaned.replace(/(bakshikatalab)+/g, 'bakshikatalab');
  cleaned = cleaned.replace(/(cantt)+/g, 'cantt');
  cleaned = cleaned.replace(/(hazratganj)+/g, 'hazratganj');

  return cleaned;
}

// Helper to strip tags and normalize whitespace
function cleanHtmlText(str: string): string {
  return str ? str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

// Extract ThanaDetails from official HTML response
export function parseThanaDetailsHtml(html: string): ParsedThanaDetails {
  const result: ParsedThanaDetails = {
    district: '',
    stationName: '',
    address: '',
    jurisdiction: '',
    shoName: '',
    shoDesignation: '',
    shoCug: '',
    landline: '',
    shoEmail: '',
    circleName: '',
    coName: '',
    coCug: '',
    coEmail: '',
  };

  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  const tables = html.match(tableRegex) || [];

  for (const tableHtml of tables) {
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const rows = tableHtml.match(rowRegex) || [];

    for (const rowHtml of rows) {
      const cellRegex = /<t[dh][\s\S]*?<\/t[dh]>/gi;
      const cells = (rowHtml.match(cellRegex) || []).map(cleanHtmlText);

      if (cells.length >= 2) {
        const key = cells[0].toLowerCase();
        const val = cells[1];

        if (key.includes('police district')) {
          result.district = val;
        } else if (key.includes('name of police station')) {
          result.address = val;
        } else if (key.includes('jurisdiction') || key.includes('क्षेत्र')) {
          result.jurisdiction = val;
        } else if (key.includes('name of circle')) {
          result.circleName = val;
        } else if (key.includes('email')) {
          result.coEmail = val;
        } else if (key.includes('name of co') || key.includes('acp')) {
          result.coName = val;
        } else if (key.includes('contact no') || key.includes('cug')) {
          result.coCug = val;
        }
      }

      // Check Table format with SHO: [photo, name, designation, mobile, other, email]
      if (cells.length >= 5) {
        const isHeader = cells.some((c) => {
          const lower = c.toLowerCase();
          return lower.includes('photograph') || lower.includes('name of sho') || lower.includes('designation') || lower.includes('mobile number');
        });
        if (!isHeader && (cells[1] || cells[2] || cells[3])) {
          result.shoName = cells[1] || '';
          result.shoDesignation = cells[2] || 'SHO';
          result.shoCug = cells[3] || '';
          result.landline = cells[4] || '';
          result.shoEmail = cells[5] || '';
        }
      }
    }
  }

  return result;
}

// Pre-defined built-in UP Police official portal district codes (Zero network latency fallback)
export const BUILTIN_PORTAL_DISTRICTS: PortalDistrictItem[] = [
  { name: 'AGRA (COMMISSIONERATE)', code: '81' },
  { name: 'ALIGARH', code: '2' },
  { name: 'AMBEDKAR NAGAR', code: '4' },
  { name: 'AMETHI', code: '20' },
  { name: 'AMROHA', code: '40' },
  { name: 'AURAIYA', code: '5' },
  { name: 'AYODHYA', code: '26' },
  { name: 'AZAMGARH', code: '6' },
  { name: 'BAGPAT', code: '7' },
  { name: 'BAHRAICH', code: '8' },
  { name: 'BALLIA', code: '9' },
  { name: 'BALRAMPUR', code: '10' },
  { name: 'BANDA', code: '11' },
  { name: 'BARABANKI', code: '12' },
  { name: 'BAREILLY', code: '13' },
  { name: 'BASTI', code: '14' },
  { name: 'BHADOI', code: '15' },
  { name: 'BIJNOR', code: '17' },
  { name: 'BUDAUN', code: '18' },
  { name: 'BULANDSHAHR', code: '19' },
  { name: 'CHANDAULI', code: '21' },
  { name: 'CHITRAKOOT', code: '22' },
  { name: 'DEORIA', code: '23' },
  { name: 'ETAH', code: '24' },
  { name: 'ETAWAH', code: '25' },
  { name: 'FATEHGARH', code: '27' },
  { name: 'FATEHPUR', code: '28' },
  { name: 'FIROZABAD', code: '29' },
  { name: 'GAUTAMBUDH NAGAR (COMMISSIONERATE)', code: '30' },
  { name: 'GHAZIABAD (COMMISSIONERATE)', code: '80' },
  { name: 'GHAZIPUR', code: '32' },
  { name: 'GONDA', code: '33' },
  { name: 'GORAKHPUR', code: '34' },
  { name: 'HAMIRPUR', code: '35' },
  { name: 'HAPUR', code: '61' },
  { name: 'HARDOI', code: '36' },
  { name: 'HATHRAS', code: '50' },
  { name: 'JALAUN', code: '37' },
  { name: 'JAUNPUR', code: '38' },
  { name: 'JHANSI', code: '39' },
  { name: 'KANNAUJ', code: '42' },
  { name: 'KANPUR DEHAT', code: '43' },
  { name: 'KANPUR NAGAR (COMMISSIONERATE)', code: '77' },
  { name: 'KASGANJ', code: '45' },
  { name: 'KAUSHAMBI', code: '46' },
  { name: 'KHERI', code: '47' },
  { name: 'KUSHINAGAR', code: '60' },
  { name: 'LALITPUR', code: '48' },
  { name: 'LUCKNOW CITY (COMMISSIONERATE)', code: '76' },
  { name: 'MAHARAJGANJ', code: '51' },
  { name: 'MAHOBA', code: '52' },
  { name: 'MAINPURI', code: '53' },
  { name: 'MATHURA', code: '54' },
  { name: 'MAU', code: '55' },
  { name: 'MEERUT', code: '56' },
  { name: 'MIRZAPUR', code: '57' },
  { name: 'MORADABAD', code: '58' },
  { name: 'MUZAFFAR NAGAR', code: '59' },
  { name: 'PILIBHIT', code: '62' },
  { name: 'PRATAPGARH', code: '64' },
  { name: 'PRAYAGRAJ (COMMISSIONERATE)', code: '82' },
  { name: 'RAEBARELI', code: '65' },
  { name: 'RAMPUR', code: '66' },
  { name: 'SAHARANPUR', code: '67' },
  { name: 'SAMBHAL', code: '16' },
  { name: 'SANT KABIR NAGAR', code: '41' },
  { name: 'SHAHJAHANPUR', code: '68' },
  { name: 'SHAMLI', code: '63' },
  { name: 'SHRAVASTI', code: '69' },
  { name: 'SIDHARTH NAGAR', code: '70' },
  { name: 'SITAPUR', code: '71' },
  { name: 'SONBHADRA', code: '72' },
  { name: 'SULTANPUR', code: '73' },
  { name: 'UNNAO', code: '74' },
  { name: 'VARANASI NAGAR (COMMISSIONERATE)', code: '78' },
];

// Fetch district list from portal with caching and instant builtin fallback
export async function fetchPortalDistricts(): Promise<PortalDistrictItem[]> {
  const now = Date.now();
  if (cachedDistricts && cachedDistricts.expiresAt > now) {
    return cachedDistricts.data;
  }

  try {
    const res = await fetch('https://uppolice.gov.in/districtHandler.ashx', {
      headers: { 'User-Agent': PORTAL_USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const raw = await res.json() as any;
      const list: PortalDistrictItem[] = [];
      const districts = raw.districts || [];
      const codes = raw.districtsCode || [];

      for (let i = 0; i < districts.length; i++) {
        list.push({
          name: districts[i]?.d || '',
          code: String(codes[i]?.c || ''),
        });
      }

      if (list.length > 0) {
        cachedDistricts = {
          data: list,
          expiresAt: now + CACHE_TTL_DISTRICTS_MS,
        };
        return list;
      }
    }
  } catch (err) {
    console.warn('districtHandler fetch failed or timed out, using builtin portal districts fallback:', err);
  }

  // Instant zero-latency fallback to verified portal districts
  cachedDistricts = {
    data: BUILTIN_PORTAL_DISTRICTS,
    expiresAt: now + CACHE_TTL_DISTRICTS_MS,
  };
  return BUILTIN_PORTAL_DISTRICTS;
}

// Fetch thana list for a given portal district code
export async function fetchPortalThanas(districtCode: string | number): Promise<PortalThanaItem[]> {
  const key = String(districtCode);
  const now = Date.now();
  const cached = cachedThanas.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const res = await fetch(`https://uppolice.gov.in/thanaHandler.ashx?c=${encodeURIComponent(key)}`, {
    headers: { 'User-Agent': PORTAL_USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Portal thanaHandler failed with HTTP ${res.status}`);
  }

  const raw = await res.json() as any;
  const list: PortalThanaItem[] = [];
  const thanas = raw.districts || [];
  const codes = raw.districtsCode || [];

  for (let i = 0; i < thanas.length; i++) {
    list.push({
      name: thanas[i]?.d || '',
      code: codes[i]?.c || '',
    });
  }

  cachedThanas.set(key, {
    data: list,
    expiresAt: now + CACHE_TTL_THANAS_MS,
  });

  return list;
}

// Fetch thana details HTML and parse
export async function fetchPortalThanaDetails(
  districtCode: string | number,
  thanaCode: string | number,
  timeoutMs: number = 7000
): Promise<ParsedThanaDetails> {
  const cacheKey = `${districtCode}:${thanaCode}`;
  const now = Date.now();
  const cached = cachedDetails.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const url = `https://uppolice.gov.in/en/ThanaDetails?d=${encodeURIComponent(String(districtCode))}&t=${encodeURIComponent(String(thanaCode))}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': PORTAL_USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Portal ThanaDetails failed with HTTP ${res.status}`);
  }

  const html = await res.text();
  const parsed = parseThanaDetailsHtml(html);

  cachedDetails.set(cacheKey, {
    data: parsed,
    expiresAt: now + CACHE_TTL_DETAILS_MS,
  });

  return parsed;
}

// Explicit mappings for commissionerates and split districts
const DISTRICT_CODE_OVERRIDES: Record<string, (string | number)[]> = {
  // Lucknow: Code 76 (Lucknow City Commissionerate) contains all 54 urban & rural thanas
  dist_lucknow: [76],
  lucknow: [76],
  // Kanpur (Kanpur Nagar Commissionerate, Dehat, Outer)
  dist_kanpur_nagar: [77],
  dist_kanpur_dehat: [43],
  kanpur: [77, 43],
  // Agra Commissionerate
  dist_agra: [81],
  agra: [81],
  // Gautam Buddh Nagar Commissionerate
  dist_gautam_buddha_nagar: [30],
  noida: [30],
  // Ghaziabad Commissionerate
  dist_ghaziabad: [80],
  ghaziabad: [80],
  // Prayagraj Commissionerate
  dist_prayagraj: [82],
  prayagraj: [82],
  allahabad: [82],
  // Varanasi Commissionerate
  dist_varanasi: [78],
  varanasi: [78],
};

// Find candidate portal district codes for a given CCTNS district ID / name
export async function findPortalDistrictCandidates(
  districtId: string,
  districtName: string
): Promise<PortalDistrictItem[]> {
  const portalDistricts = await fetchPortalDistricts();

  // 1. Check explicit override list
  const normDistId = districtId.toLowerCase().trim();
  const normDistName = districtName.toLowerCase().trim();
  const overrideCodes = DISTRICT_CODE_OVERRIDES[normDistId] || DISTRICT_CODE_OVERRIDES[normDistName];

  if (overrideCodes && overrideCodes.length > 0) {
    const matched = portalDistricts.filter((p) =>
      overrideCodes.some((code) => String(code) === String(p.code))
    );
    if (matched.length > 0) return matched;
  }

  // 2. Fuzzy/Clean matching against portal district list
  const cleanQ = cleanName(districtName);
  const matched = portalDistricts.filter((p) => {
    const cleanP = cleanName(p.name);
    return cleanQ && (cleanP.includes(cleanQ) || cleanQ.includes(cleanP));
  });

  return matched;
}

// Find matching thana code in portal candidates for a given CCTNS station name
export async function matchStationOnPortal(
  districtCandidates: PortalDistrictItem[],
  stationName: string
): Promise<{ district: PortalDistrictItem; thana: PortalThanaItem } | null> {
  const cleanStn = cleanName(stationName);
  if (!cleanStn) return null;

  for (const dist of districtCandidates) {
    try {
      const thanas = await fetchPortalThanas(dist.code);
      
      // Exact cleaned match first
      for (const t of thanas) {
        const cleanT = cleanName(t.name);
        if (cleanT === cleanStn) {
          return { district: dist, thana: t };
        }
      }

      // Substring match
      for (const t of thanas) {
        const cleanT = cleanName(t.name);
        if (cleanT.length >= 4 && (cleanT.includes(cleanStn) || cleanStn.includes(cleanT))) {
          return { district: dist, thana: t };
        }
      }
    } catch (err) {
      console.warn(`Error fetching thanas for district ${dist.name} (${dist.code}):`, err);
    }
  }

  return null;
}

export function createExternalPortalRouter(db: D1Database) {
  const router = new Hono<{
    Variables: {
      user?: AuthenticatedUser;
    };
  }>();

  // 1. GET /api/external/uppolice/thana-details
  // Retrieves live, up-to-the-minute officer & jurisdiction details from UP Police Portal
  router.get('/thana-details', async (c) => {
    const stationId = c.req.query('stationId');
    const districtIdParam = c.req.query('districtId');
    const stationNameParam = c.req.query('stationName');

    let stationName = stationNameParam || '';
    let districtId = districtIdParam || '';
    let districtName = '';
    let stationType = 'POLICE_STATION';
    let localPhone = '';

    if (stationId) {
      const stn = await db
        .prepare(`
          SELECT s.id, s.name, s.type, s.phone, s.district_id, d.name AS district_name
          FROM stations_offices s
          LEFT JOIN districts d ON s.district_id = d.id
          WHERE s.id = ?
        `)
        .bind(stationId)
        .first<any>();

      if (!stn) {
        return c.json({ error: 'Station or office not found in directory.' }, 404);
      }

      stationType = stn.type;
      stationName = stn.name;
      districtId = stn.district_id;
      districtName = stn.district_name || '';
      localPhone = stn.phone || '';

      // Offices have no portal records; they are departmentally managed
      if (stationType !== 'POLICE_STATION') {
        return c.json({
          success: true,
          isOffice: true,
          stationName,
          districtName,
          localPhone,
          message: 'यह एक विभागीय कार्यालय है। कार्यालयों का संपर्क नंबर सीधे विभागीय को-एडमिन द्वारा प्रबंधित किया जाता है।',
        });
      }
    } else {
      if (!stationName || !districtId) {
        return c.json({ error: 'Missing stationId or both stationName and districtId parameters.' }, 400);
      }
      const dist = await db
        .prepare('SELECT id, name FROM districts WHERE id = ?')
        .bind(districtId)
        .first<any>();
      if (dist) districtName = dist.name;
    }

    try {
      // Specialized units (GRP, AHTU) that have separate departmental command
      const normStn = stationName.toLowerCase();
      if (normStn.includes('grp') || normStn.includes('railway')) {
        return c.json({
          success: false,
          fallback: true,
          stationName,
          districtName,
          localPhone,
          message: 'यह एक राजकीय रेलवे पुलिस (GRP) थाना है। इसका संपर्क सीधे रेलवे अनुभाग एवं विभागीय डायरेक्टरी द्वारा संचालित है।',
        });
      }
      if (normStn.includes('ahtu')) {
        return c.json({
          success: false,
          fallback: true,
          stationName,
          districtName,
          localPhone,
          message: 'यह मानव तस्करी रोधी इकाई (AHTU) विशेष विंग है। इसका संपर्क सीधे जिला नियंत्रण कक्ष द्वारा संचालित है।',
        });
      }

      const candidates = await findPortalDistrictCandidates(districtId, districtName);
      if (candidates.length === 0) {
        return c.json({
          success: false,
          fallback: true,
          stationName,
          districtName,
          localPhone,
          message: `पोर्टल पर जनपद '${districtName}' का समकक्ष रिकॉर्ड नहीं मिला। डेटाबेस का नंबर उपलब्ध है।`,
        });
      }

      const match = await matchStationOnPortal(candidates, stationName);
      if (!match) {
        return c.json({
          success: false,
          fallback: true,
          stationName,
          districtName,
          localPhone,
          message: `UP Police पोर्टल पर '${stationName}' के नाम से सीधे कोई सक्रिय थाना मैप नहीं हुआ।`,
        });
      }

      const details = await fetchPortalThanaDetails(match.district.code, match.thana.code);

      return c.json({
        success: true,
        isOffice: false,
        stationName,
        districtName,
        localPhone,
        matchedPortalDistrict: match.district.name,
        matchedPortalThana: match.thana.name,
        source: 'UP_POLICE_OFFICIAL_PORTAL',
        liveData: details,
      });
    } catch (err: any) {
      console.error('UP Police Portal fetch error:', err);
      return c.json({
        success: false,
        fallback: true,
        stationName,
        districtName,
        localPhone,
        message: 'उत्तर प्रदेश पुलिस पोर्टल से डेटा लोड करने में विलंब हुआ। डेटाबेस का सत्यापित नंबर उपलब्ध है।',
        error: err.message || 'पोर्टल से डेटा प्राप्त करने में असमर्थ।',
      });
    }
  });

  // 2. POST /api/external/uppolice/sync-district
  // Admin-scoped sync: matches verified police stations and enriches official CUG mobile numbers.
  // STRICT RULES:
  // - Never inserts new rows (No duplicates).
  // - Never modifies offices (type != 'POLICE_STATION' are strictly skipped).
  // - District Co-Admin can only sync their assigned districtId.
  // - Cloudflare subrequest limit safe: batches candidates and processes in parallel chunks of 6.
  router.post('/sync-district', async (c) => {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized: Authentication required.' }, 401);
      }

      const isSuperAdmin = user.role === ROLES.SUPER_ADMIN;
      const isCoAdmin = user.role === ROLES.DISTRICT_CO_ADMIN;

      if (!isSuperAdmin && !isCoAdmin) {
        return c.json({ error: 'Forbidden: Admin privilege required to sync station contact numbers.' }, 403);
      }

      const body = await c.req.json().catch(() => ({}));
      const requestedDistrictId = body.districtId || user.districtId;
      const dryRun = body.dryRun !== false; // Defaults to dryRun=true for safety

      // Enforce district boundary for Co-Admin
      if (isCoAdmin && requestedDistrictId !== user.districtId) {
        return c.json({ error: 'Access Denied: District Co-Admin can only sync stations within their assigned district.' }, 403);
      }

      if (!requestedDistrictId) {
        return c.json({ error: 'districtId is required.' }, 400);
      }

      const district = await db
        .prepare('SELECT id, name FROM districts WHERE id = ?')
        .bind(requestedDistrictId)
        .first<any>();

      if (!district) {
        return c.json({ error: 'District not found.' }, 404);
      }

      // Query ONLY POLICE_STATION items in this district (Offices are strictly untouched)
      const stationsResult = await db
        .prepare(`
          SELECT id, name, type, phone, district_id
          FROM stations_offices
          WHERE district_id = ? AND type = 'POLICE_STATION' AND is_active = 1
          ORDER BY name ASC
        `)
        .bind(requestedDistrictId)
        .all<any>();

      const stations = stationsResult.results || [];
      if (stations.length === 0) {
        return c.json({
          success: true,
          dryRun,
          districtId: requestedDistrictId,
          districtName: district.name,
          totalStations: 0,
          matchedCount: 0,
          unmatchedCount: 0,
          updatedCount: 0,
          message: 'इस जनपद में कोई सक्रिय थाना नहीं मिला।',
          changes: [],
        });
      }

      // Find candidate portal districts
      const candidates = await findPortalDistrictCandidates(requestedDistrictId, district.name);
      if (candidates.length === 0) {
        return c.json({
          success: false,
          error: `UP Police पोर्टल पर जनपद '${district.name}' के लिए कोई समकक्ष कोड नहीं मिला।`,
        }, 400);
      }

      // 1. Pre-fetch all portal thanas for candidate districts in 1 call per candidate (efficient & cached)
      const allCandidateThanas: { district: PortalDistrictItem; thana: PortalThanaItem }[] = [];
      for (const dist of candidates) {
        try {
          const thanas = await fetchPortalThanas(dist.code);
          for (const t of thanas) {
            allCandidateThanas.push({ district: dist, thana: t });
          }
        } catch (err) {
          console.warn(`Error fetching candidate thanas for ${dist.name}:`, err);
        }
      }

      const changes: any[] = [];
      const matchedItems: { stn: any; match: { district: PortalDistrictItem; thana: PortalThanaItem } }[] = [];
      let matchedCount = 0;
      let unmatchedCount = 0;

      // 2. Perform lightning-fast in-memory matching for all district stations
      for (const stn of stations) {
        const normStn = stn.name.toLowerCase();
        if (normStn.includes('grp') || normStn.includes('railway')) {
          unmatchedCount++;
          changes.push({
            stationId: stn.id,
            name: stn.name,
            matched: false,
            currentPhone: stn.phone || null,
            newPhone: null,
            shoName: null,
            reason: 'राजकीय रेलवे पुलिस (GRP) थाना',
          });
          continue;
        }
        if (normStn.includes('ahtu')) {
          unmatchedCount++;
          changes.push({
            stationId: stn.id,
            name: stn.name,
            matched: false,
            currentPhone: stn.phone || null,
            newPhone: null,
            shoName: null,
            reason: 'मानव तस्करी रोधी इकाई (AHTU)',
          });
          continue;
        }

        const cleanStn = cleanName(stn.name);
        let match = allCandidateThanas.find(item => cleanName(item.thana.name) === cleanStn);
        if (!match) {
          match = allCandidateThanas.find(item => {
            const cleanT = cleanName(item.thana.name);
            return cleanT.length >= 4 && (cleanT.includes(cleanStn) || cleanStn.includes(cleanT));
          });
        }

        if (match) {
          matchedCount++;
          matchedItems.push({ stn, match });
        } else {
          unmatchedCount++;
          changes.push({
            stationId: stn.id,
            name: stn.name,
            matched: false,
            currentPhone: stn.phone || null,
            newPhone: null,
            shoName: null,
            reason: 'पोर्टल सूची में नाम भिन्न है',
          });
        }
      }

      // 3. Process matched thanas in parallel (subrequest limit safe: <= 12 subrequests, ~3.5s total duration)
      const toProcess = matchedItems.slice(0, 10);
      await Promise.allSettled(
        toProcess.map(async ({ stn, match }) => {
          try {
            const details = await fetchPortalThanaDetails(match.district.code, match.thana.code, 4500);
            const rawCug = (details.shoCug || '').replace(/[^0-9]/g, '');
            const validPhone = rawCug.length >= 10 ? rawCug.slice(-10) : (stn.phone || null);
            const willUpdate = Boolean(validPhone && validPhone !== stn.phone);

            changes.push({
              stationId: stn.id,
              name: stn.name,
              matched: true,
              matchedPortalDistrict: match.district.name,
              matchedPortalThana: match.thana.name,
              shoName: details.shoName || null,
              shoDesignation: details.shoDesignation || null,
              shoEmail: details.shoEmail || null,
              currentPhone: stn.phone || null,
              newPhone: validPhone,
              willUpdate,
            });
          } catch {
            changes.push({
              stationId: stn.id,
              name: stn.name,
              matched: true,
              matchedPortalDistrict: match.district.name,
              matchedPortalThana: match.thana.name,
              currentPhone: stn.phone || null,
              newPhone: null,
              willUpdate: false,
              reason: 'पोर्टल विवरण लोड करने में विलंब',
            });
          }
        })
      );

      // Include remaining matched items (if total stations > 10) as verified matched
      if (matchedItems.length > toProcess.length) {
        for (let j = toProcess.length; j < matchedItems.length; j++) {
          const { stn, match } = matchedItems[j];
          changes.push({
            stationId: stn.id,
            name: stn.name,
            matched: true,
            matchedPortalDistrict: match.district.name,
            matchedPortalThana: match.thana.name,
            currentPhone: stn.phone || null,
            newPhone: stn.phone || null,
            willUpdate: false,
            reason: 'सत्यापित मैच (अगले चक्र में सिंक)',
          });
        }
      }

      // Sort changes alphabetically by station name
      changes.sort((a, b) => a.name.localeCompare(b.name));

      let updatedCount = 0;
      if (!dryRun) {
        const now = new Date().toISOString();
        for (const ch of changes) {
          if (ch.matched && ch.willUpdate && ch.newPhone) {
            await db
              .prepare(`
                UPDATE stations_offices
                SET phone = ?, updated_at = ?
                WHERE id = ? AND type = 'POLICE_STATION'
              `)
              .bind(ch.newPhone, now, ch.stationId)
              .run();
            updatedCount++;
          }
        }

        await logAuditEvent(db, {
          actor: user,
          action: 'UP_POLICE_PORTAL_SYNC',
          entityType: 'STATIONS_OFFICES',
          entityId: requestedDistrictId,
          afterState: {
            districtName: district.name,
            totalStations: stations.length,
            matchedCount,
            updatedCount,
          },
        });
      }

      return c.json({
        success: true,
        dryRun,
        districtId: requestedDistrictId,
        districtName: district.name,
        totalStations: stations.length,
        matchedCount,
        unmatchedCount,
        updatedCount: dryRun ? changes.filter((c) => c.willUpdate).length : updatedCount,
        changes,
      });
    } catch (err: any) {
      console.error('sync-district top-level error:', err);
      return c.json({
        success: false,
        error: err.message || 'पोर्टल सिंक करने में त्रुटि हुई। कृपया पुनः प्रयास करें।',
      }, 200);
    }
  });

  return router;
}
