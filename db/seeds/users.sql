INSERT OR REPLACE INTO users (
  id, pno, full_name, designation_id, district_id, station_office_id, mobile, status, role, password_hash, terms_accepted_version, created_at, updated_at
) VALUES
('usr_seed_super', '00000001', 'Vikramaditya Rathore', 'desig_dgp', 'dist_lucknow', 'stn_lko_sp_office', '9800000001', 'ACTIVE', 'SUPER_ADMIN', '2216f4a04a9ccc71c48a4b2bc0e09800:e89d882ebdab53e487e42e9214c87000e56fdf577231e72ecdee9f911c950d90c786544a86896bde3154431c4da191652f21ed399c0d95f8ea729a743ed2d752', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('usr_seed_lko_co', '00000002', 'Siddharth Mehra', 'desig_asp', 'dist_lucknow', 'stn_lko_sp_office', '9800000002', 'ACTIVE', 'DISTRICT_CO_ADMIN', '0bf4ab129b3db7291cd5e56302ea42bb:077f440bd9ff9a6928971ac665204f93978ad92b3728dc9695bcd3d140f2e36d39f0b2c45bb1b49c85efa6dbae38e66736be06d41a57ac14782e78fd6df0e051', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('usr_seed_vns_co', '00000003', 'Anuradha Verma', 'desig_asp', 'dist_varanasi', 'stn_vns_sp_office', '9800000003', 'ACTIVE', 'DISTRICT_CO_ADMIN', '0bf4ab129b3db7291cd5e56302ea42bb:077f440bd9ff9a6928971ac665204f93978ad92b3728dc9695bcd3d140f2e36d39f0b2c45bb1b49c85efa6dbae38e66736be06d41a57ac14782e78fd6df0e051', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('usr_seed_lko_1', '00112233', 'Rajesh Kumar Singh', 'desig_insp', 'dist_lucknow', 'stn_lko_hazratganj', '9876543210', 'ACTIVE', 'USER', 'aead7f49eda17d987ccca0618e4ba145:524bcbaacc141135a0eb5aa15bc9817e313d63a46ae277a6838c124cd0478195a25f2d1b34d1ed8b97383751d311e20f04dbd3125a63fea25cdeacf7a23b6e73', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('usr_seed_lko_2', '00112234', 'Manoj Tiwari', 'desig_si', 'dist_lucknow', 'stn_lko_hazratganj', '9876543211', 'ACTIVE', 'USER', 'aead7f49eda17d987ccca0618e4ba145:524bcbaacc141135a0eb5aa15bc9817e313d63a46ae277a6838c124cd0478195a25f2d1b34d1ed8b97383751d311e20f04dbd3125a63fea25cdeacf7a23b6e73', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('usr_seed_lko_3', '00112235', 'Suresh Chandra', 'desig_const', 'dist_lucknow', 'stn_lko_gomtinagar', '9876543212', 'ACTIVE', 'USER', 'aead7f49eda17d987ccca0618e4ba145:524bcbaacc141135a0eb5aa15bc9817e313d63a46ae277a6838c124cd0478195a25f2d1b34d1ed8b97383751d311e20f04dbd3125a63fea25cdeacf7a23b6e73', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('usr_seed_vns_1', '00223344', 'Kailash Nath Pandey', 'desig_insp', 'dist_varanasi', 'stn_vns_cantt', '9876543220', 'ACTIVE', 'USER', 'aead7f49eda17d987ccca0618e4ba145:524bcbaacc141135a0eb5aa15bc9817e313d63a46ae277a6838c124cd0478195a25f2d1b34d1ed8b97383751d311e20f04dbd3125a63fea25cdeacf7a23b6e73', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('usr_seed_vns_2', '00223345', 'Pooja Tripathi', 'desig_si', 'dist_varanasi', 'stn_vns_dashashwamedh', '9876543221', 'ACTIVE', 'USER', 'aead7f49eda17d987ccca0618e4ba145:524bcbaacc141135a0eb5aa15bc9817e313d63a46ae277a6838c124cd0478195a25f2d1b34d1ed8b97383751d311e20f04dbd3125a63fea25cdeacf7a23b6e73', '1.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('usr_seed_pending_1', '00334455', 'Deepak Mishra', 'desig_const', 'dist_lucknow', 'stn_lko_hazratganj', '9876543300', 'PENDING', 'USER', 'aead7f49eda17d987ccca0618e4ba145:524bcbaacc141135a0eb5aa15bc9817e313d63a46ae277a6838c124cd0478195a25f2d1b34d1ed8b97383751d311e20f04dbd3125a63fea25cdeacf7a23b6e73', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
