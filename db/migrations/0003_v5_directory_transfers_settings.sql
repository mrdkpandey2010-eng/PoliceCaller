-- Migration 0003: System settings for Super Admin controls
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Default: District Co-Admins can access Excel Bulk Import initially (can be toggled off by Super Admin)
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('coadmin_excel_import_enabled', 'true');
