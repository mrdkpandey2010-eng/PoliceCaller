-- Seed Police Stations, Offices and Initial Versioned Policy

-- Stations & Offices
INSERT OR IGNORE INTO stations_offices (id, district_id, name, type, address, phone, is_active) VALUES
-- Lucknow
('stn_lko_hazratganj', 'dist_lucknow', 'PS Hazratganj', 'POLICE_STATION', 'Hazratganj, Lucknow', '05222238491', 1),
('stn_lko_gomtinagar', 'dist_lucknow', 'PS Gomti Nagar', 'POLICE_STATION', 'Gomti Nagar, Lucknow', '05222728192', 1),
('stn_lko_sp_office', 'dist_lucknow', 'SP City Office Lucknow', 'SP_OFFICE', 'Police Line, Lucknow', '05222200100', 1),
('stn_lko_line', 'dist_lucknow', 'Reserve Police Line Lucknow', 'LINE', 'Mahanagar, Lucknow', '05222200101', 1),
-- Varanasi
('stn_vns_cantt', 'dist_varanasi', 'PS Cantt Varanasi', 'POLICE_STATION', 'Cantonment, Varanasi', '05422501234', 1),
('stn_vns_dashashwamedh', 'dist_varanasi', 'PS Dashashwamedh', 'POLICE_STATION', 'Dashashwamedh Ghat, Varanasi', '05422505678', 1),
('stn_vns_sp_office', 'dist_varanasi', 'SSP Office Varanasi', 'SP_OFFICE', 'Kachehari, Varanasi', '05422509999', 1),
-- Prayagraj
('stn_pry_civil_lines', 'dist_prayagraj', 'PS Civil Lines', 'POLICE_STATION', 'Civil Lines, Prayagraj', '05322401122', 1),
('stn_pry_sp_office', 'dist_prayagraj', 'SSP Office Prayagraj', 'SP_OFFICE', 'Collectorate, Prayagraj', '05322403344', 1),
-- Kanpur Nagar
('stn_kpn_kotwali', 'dist_kanpur_nagar', 'PS Kotwali', 'POLICE_STATION', 'Kotwali, Kanpur Nagar', '05122301122', 1),
-- Gorakhpur
('stn_gkp_cantt', 'dist_gorakhpur', 'PS Cantt Gorakhpur', 'POLICE_STATION', 'Cantt, Gorakhpur', '05512334455', 1),
-- Agra
('stn_agr_tajganj', 'dist_agra', 'PS Tajganj', 'POLICE_STATION', 'Tajganj, Agra', '05622233445', 1),
-- Meerut
('stn_mrt_civil_lines', 'dist_meerut', 'PS Civil Lines Meerut', 'POLICE_STATION', 'Civil Lines, Meerut', '01212601122', 1);

-- Version 1.0 Departmental Terms & Conditions Policy
INSERT OR IGNORE INTO policies (id, version, title_en, title_hi, content_en, content_hi, type, is_active, published_at) VALUES
('pol_terms_v1', '1.0', 
 'Departmental Terms of Service & Confidentiality', 
 'विभागीय सेवा शर्तें एवं गोपनीयता नीति',
 '1. Confidentiality: All personnel information, communications, and departmental notices contained within this directory are strictly official and confidential.
2. Official Use Only: Authorized access is granted solely to approved active personnel of the Uttar Pradesh Police. Unauthorized reproduction, forwarding, or sharing of contact numbers, messages, or departmental circulars is punishable under departmental rules and the Information Technology Act.
3. Accurate English Structured Information: Personnel must ensure all personal and service records are entered accurately in canonical English/ASCII characters.
4. Accountability: System access, profile edits, transfers, and real-time communications are audited. Users are responsible for all activities initiated under their credential.',
 '1. गोपनीयता: इस निर्देशिका में निहित सभी कार्मिक जानकारी, संचार और विभागीय आदेश पूरी तरह से आधिकारिक और गोपनीय हैं।
2. केवल आधिकारिक उपयोग: केवल उत्तर प्रदेश पुलिस के स्वीकृत सक्रिय कर्मियों को ही पहुंच की अनुमति है। विभागीय नियमों तथा आईटी एक्ट के तहत अनाधिकृत साझाकरण दंडनीय है।
3. सत्य एवं प्रामाणिक अंग्रेजी जानकारी: सभी कार्मिकों को अपने सेवा विवरण केवल आधिकारिक अंग्रेजी अक्षरों में दर्ज कराने होंगे।
4. जवाबदेही: सभी गतिविधियाँ, स्थानांतरण और संदेश ऑडिट किए जाते हैं। अपने खाते से की गई हर गतिविधि के लिए कर्मी स्वयं जिम्मेदार होगा।',
 'TERMS', 1, CURRENT_TIMESTAMP);
