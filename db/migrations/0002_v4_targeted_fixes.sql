-- V4 Targeted Fixes Migration
-- 1. Conversation User Visibility for Delete for Me on full conversations
CREATE TABLE IF NOT EXISTS conversation_user_visibility (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    is_hidden INTEGER NOT NULL DEFAULT 1,
    hidden_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    last_hidden_sequence_num INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(user_id, conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_vis_user ON conversation_user_visibility(user_id, conversation_id);

-- 2. Contact Diaries & Resource Library (V4.5)
CREATE TABLE IF NOT EXISTS contact_diaries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'GENERAL',
    district_id TEXT REFERENCES districts(id),
    source_date TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('URL', 'PDF', 'XLSX', 'XLS', 'CSV')),
    external_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_data TEXT,
    mime_type TEXT,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    is_published INTEGER NOT NULL DEFAULT 1,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_diaries_district ON contact_diaries(district_id);
CREATE INDEX IF NOT EXISTS idx_diaries_category ON contact_diaries(category);

-- 3. Device Diagnostics Enhancement (V4.9)
ALTER TABLE devices ADD COLUMN ip_address TEXT;
ALTER TABLE devices ADD COLUMN browser_name TEXT;
ALTER TABLE devices ADD COLUMN notification_state TEXT DEFAULT 'DEFAULT';
ALTER TABLE devices ADD COLUMN battery_level TEXT;
ALTER TABLE devices ADD COLUMN locale TEXT;
