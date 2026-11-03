-- 0005_station_portal_details.sql
-- Cached portal details for instant station information lookup

CREATE TABLE IF NOT EXISTS station_portal_details (
  station_id TEXT PRIMARY KEY REFERENCES stations_offices(id) ON DELETE CASCADE,
  district_id TEXT,
  district_name TEXT,
  station_name TEXT,
  sho_name TEXT,
  sho_designation TEXT,
  sho_cug TEXT,
  landline TEXT,
  sho_email TEXT,
  circle_name TEXT,
  co_name TEXT,
  co_cug TEXT,
  co_email TEXT,
  jurisdiction TEXT,
  address TEXT,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_station_portal_district ON station_portal_details(district_id);
