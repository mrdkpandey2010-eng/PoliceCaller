-- UP Police Standard Hierarchy Designations Seed
INSERT OR IGNORE INTO designations (id, code, name, short_name, rank_order, is_active) VALUES
('desig_dgp', 'DGP', 'Director General of Police', 'DGP', 1, 1),
('desig_adg', 'ADG', 'Additional Director General of Police', 'ADG', 2, 1),
('desig_ig', 'IG', 'Inspector General of Police', 'IG', 3, 1),
('desig_dig', 'DIG', 'Deputy Inspector General of Police', 'DIG', 4, 1),
('desig_ssp', 'SSP', 'Senior Superintendent of Police', 'SSP', 5, 1),
('desig_sp', 'SP', 'Superintendent of Police', 'SP', 6, 1),
('desig_asp', 'ASP', 'Additional Superintendent of Police', 'Addl. SP', 7, 1),
('desig_co_dsp', 'DSP', 'Deputy Superintendent of Police (CO)', 'DSP/CO', 8, 1),
('desig_insp', 'INSP', 'Inspector of Police', 'Inspector', 9, 1),
('desig_si', 'SI', 'Sub-Inspector of Police', 'SI', 10, 1),
('desig_asi', 'ASI', 'Assistant Sub-Inspector of Police', 'ASI', 11, 1),
('desig_hc', 'HC', 'Head Constable', 'HC', 12, 1),
('desig_const', 'CONST', 'Constable', 'Constable', 13, 1);
