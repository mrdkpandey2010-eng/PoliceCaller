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
  n = n.replace(/b\.?t\.?k\.?|bkt/g, 'bakshikatalab');
  n = n.replace(/p\.?g\.?i\.?/g, 'pgi');
  n = n.replace(/g\.?r\.?p\.?/g, 'grp');
  n = n.replace(/cantt\.?/g, 'cantt');
  n = n.replace(/\b(chhavani|chhawani|chhavni)\b/g, '');

  // Deduplicate identical repeated tokens
  n = n.replace(/(bakshikatalab)+/g, 'bakshikatalab');
  n = n.replace(/(cantt)+/g, 'cantt');
  n = n.replace(/(hazratganj)+/g, 'hazratganj');

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

// Fetch district list from portal with caching
export async function fetchPortalDistricts(): Promise<PortalDistrictItem[]> {
  const now = Date.now();
  if (cachedDistricts && cachedDistricts.expiresAt > now) {
    return cachedDistricts.data;
  }

  const res = await fetch('https://uppolice.gov.in/districtHandler.ashx', {
    headers: { 'User-Agent': PORTAL_USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Portal districtHandler failed with HTTP ${res.status}`);
  }

  const raw = await res.json() as any;
  const list: PortalDistrictItem[] = [];
  const districts = raw.districts || [];
  const codes = raw.districtsCode || [];

  for (let i = 0; i < districts.length; i++) {
    list.push({
      name: districts[i]?.d || '',
      code: codes[i]?.c || '',
    });
  }

  cachedDistricts = {
    data: list,
    expiresAt: now + CACHE_TTL_DISTRICTS_MS,
  };

  return list;
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
    signal: AbortSignal.timeout(15000),
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
  thanaCode: string | number
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
    signal: AbortSignal.timeout(15000),
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
  // Lucknow (City Commissionerate & Rural)
  dist_lucknow: [76, 28],
  lucknow: [76, 28],
  // Kanpur (Kanpur Nagar Commissionerate, Dehat, Outer)
  dist_kanpur_nagar: [77, 23],
  dist_kanpur_dehat: [22],
  kanpur: [77, 22, 23],
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
  // Varanasi Commissionerate & Rural
  dist_varanasi: [78, 72],
  varanasi: [78, 72],
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
        error: err.message || 'पोर्टल से डेटा प्राप्त करने में असमर्थ।',
      }, 502);
    }
  });

  // 2. POST /api/external/uppolice/sync-district
  // Admin-scoped sync: matches verified police stations and enriches official CUG mobile numbers.
  // STRICT RULES:
  // - Never inserts new rows (No duplicates).
  // - Never modifies offices (type != 'POLICE_STATION' are strictly skipped).
  // - District Co-Admin can only sync their assigned districtId.
  router.post('/sync-district', async (c) => {
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

    const changes: any[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    // Process stations in batches to prevent overwhelming portal
    for (const stn of stations) {
      try {
        const match = await matchStationOnPortal(candidates, stn.name);
        if (!match) {
          unmatchedCount++;
          changes.push({
            stationId: stn.id,
            name: stn.name,
            matched: false,
            currentPhone: stn.phone || null,
            newPhone: null,
            shoName: null,
            reason: 'पोर्टल पर थाने का नाम नहीं मिला',
          });
          continue;
        }

        matchedCount++;
        const details = await fetchPortalThanaDetails(match.district.code, match.thana.code);
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
      } catch (stnErr) {
        console.warn(`Failed to inspect thana ${stn.name}:`, stnErr);
        unmatchedCount++;
        changes.push({
          stationId: stn.id,
          name: stn.name,
          matched: false,
          currentPhone: stn.phone || null,
          newPhone: null,
          reason: 'पोर्टल विवरण लोड करने में त्रुटि',
        });
      }
    }

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
  });

  return router;
}
