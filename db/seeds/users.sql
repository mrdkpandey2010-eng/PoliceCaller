INSERT OR REPLACE INTO users (
  id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash, terms_accepted_version, created_at, updated_at
) VALUES
('usr_seed_super', '00000001', 'Vikramaditya Rathore', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9800000001', 'ACTIVE', 'SUPER_ADMIN', '2216f4a04a9ccc71c48a4b2bc0e09800:e89d882ebdab53e487e42e9214c87000e56fdf577231e72ecdee9f911c950d90c786544a86896bde3154431c4da191652f21ed399c0d95f8ea729a743ed2d752', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
