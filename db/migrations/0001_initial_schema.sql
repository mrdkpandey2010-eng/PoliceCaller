-- UP Police Directory & Realtime Messenger D1 Initial Schema
-- Migration: 0001_initial_schema.sql

-- 1. Districts (75 official revenue districts of Uttar Pradesh)
CREATE TABLE IF NOT EXISTS districts (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    zone TEXT,
    range TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_districts_name ON districts(name);
CREATE INDEX IF NOT EXISTS idx_districts_code ON districts(code);

-- 2. Stations & Offices Master
CREATE TABLE IF NOT EXISTS stations_offices (
    id TEXT PRIMARY KEY,
    district_id TEXT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('POLICE_STATION', 'CIRCLE_OFFICE', 'SP_OFFICE', 'LINE', 'TRAFFIC', 'OTHER')),
    address TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(district_id, name)
);

CREATE INDEX IF NOT EXISTS idx_stations_district ON stations_offices(district_id);
CREATE INDEX IF NOT EXISTS idx_stations_type ON stations_offices(type);

-- 3. Designations Master
CREATE TABLE IF NOT EXISTS designations (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    short_name TEXT NOT NULL,
    rank_order INTEGER NOT NULL DEFAULT 99,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_designations_rank ON designations(rank_order ASC);

-- 4. Users Table (Canonical English/ASCII records)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    pno TEXT NOT NULL UNIQUE, -- Canonical string identifier, preserves leading zeros
    full_name TEXT NOT NULL,
    designation_id TEXT NOT NULL REFERENCES designations(id),
    district_id TEXT NOT NULL REFERENCES districts(id),
    station_office_id TEXT NOT NULL REFERENCES stations_offices(id),
    mobile TEXT NOT NULL UNIQUE,
    whatsapp TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED')),
    photo_url TEXT,
    role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('SUPER_ADMIN', 'DISTRICT_CO_ADMIN', 'USER')),
    password_hash TEXT NOT NULL,
    mfa_enabled INTEGER NOT NULL DEFAULT 0,
    mfa_secret TEXT,
    terms_accepted_version TEXT,
    terms_accepted_at TEXT,
    notification_pref TEXT DEFAULT 'DEFAULT',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_users_pno ON users(pno);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_district ON users(district_id);
CREATE INDEX IF NOT EXISTS idx_users_station ON users(station_office_id);
CREATE INDEX IF NOT EXISTS idx_users_designation ON users(designation_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 5. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    last_active_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    is_revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(is_revoked);

-- 6. Devices Table (Active device logs & push tokens)
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK(platform IN ('ANDROID', 'WEB', 'IOS')),
    device_name TEXT,
    os_version TEXT,
    app_version TEXT,
    push_token TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_seen_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(user_id, platform, device_name)
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- 7. Password Reset Single-Use Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by TEXT REFERENCES users(id),
    is_used INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_pw_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pw_reset_token ON password_reset_tokens(token_hash);

-- 8. Policies CMS (Versioned & Immutable)
CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    title_en TEXT NOT NULL,
    title_hi TEXT NOT NULL,
    content_en TEXT NOT NULL,
    content_hi TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('TERMS', 'PRIVACY', 'DISCLAIMER', 'SECURITY')),
    is_active INTEGER NOT NULL DEFAULT 1,
    published_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    created_by TEXT REFERENCES users(id)
);

-- 9. Policy Acceptances
CREATE TABLE IF NOT EXISTS policy_acceptances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_id TEXT NOT NULL REFERENCES policies(id),
    policy_version TEXT NOT NULL,
    accepted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    ip_address TEXT,
    UNIQUE(user_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_policy_acc_user ON policy_acceptances(user_id);

-- 10. Transfers
CREATE TABLE IF NOT EXISTS transfer_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_district_id TEXT NOT NULL REFERENCES districts(id),
    source_station_id TEXT NOT NULL REFERENCES stations_offices(id),
    destination_district_id TEXT NOT NULL REFERENCES districts(id),
    destination_station_id TEXT NOT NULL REFERENCES stations_offices(id),
    reason TEXT NOT NULL,
    order_reference TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by TEXT REFERENCES users(id),
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_transfers_user ON transfer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfers_dest_district ON transfer_requests(destination_district_id);
CREATE INDEX IF NOT EXISTS idx_transfers_src_district ON transfer_requests(source_district_id);

-- 11. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('DIRECT', 'GROUP')),
    title TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 12. Conversation Members
CREATE TABLE IF NOT EXISTS conversation_members (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('MEMBER', 'ADMIN')),
    joined_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    last_read_message_id TEXT,
    last_read_at TEXT,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);

-- 13. Messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id),
    sequence_num INTEGER NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'TEXT' CHECK(message_type IN ('TEXT', 'IMAGE', 'DOCUMENT')),
    attachment_url TEXT,
    attachment_meta TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(conversation_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, sequence_num DESC);

-- 14. Message Receipts
CREATE TABLE IF NOT EXISTS message_receipts (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivered_at TEXT,
    read_at TEXT,
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_msg ON message_receipts(message_id);

-- 15. User Message Visibility (Delete for Me tombstone)
CREATE TABLE IF NOT EXISTS user_message_visibility (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    is_hidden INTEGER NOT NULL DEFAULT 1,
    hidden_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_visibility_user ON user_message_visibility(user_id, message_id);

-- 16. Notices & Departmental Orders
CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'NORMAL' CHECK(urgency IN ('NORMAL', 'URGENT', 'CRITICAL')),
    target_scope TEXT NOT NULL CHECK(target_scope IN ('STATEWIDE', 'DISTRICT', 'CO_ADMINS', 'CUSTOM')),
    target_district_id TEXT REFERENCES districts(id),
    attachment_url TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    published_by TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_notices_scope ON notices(target_scope);
CREATE INDEX IF NOT EXISTS idx_notices_district ON notices(target_district_id);

-- 17. Notice Recipients & Read Receipts
CREATE TABLE IF NOT EXISTS notice_recipients (
    id TEXT PRIMARY KEY,
    notice_id TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TEXT,
    acknowledged_at TEXT,
    UNIQUE(notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_recipients_user ON notice_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_notice_recipients_notice ON notice_recipients(notice_id);

-- 18. Favorites
CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(user_id, target_user_id)
);

-- 19. Recent Searches
CREATE TABLE IF NOT EXISTS recent_searches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_recent_searches_user ON recent_searches(user_id, created_at DESC);

-- 20. Excel Bulk Import Jobs
CREATE TABLE IF NOT EXISTS excel_import_jobs (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES users(id),
    district_id TEXT REFERENCES districts(id),
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PARSED' CHECK(status IN ('PARSED', 'PREVIEW', 'COMMITTED', 'ROLLED_BACK', 'FAILED')),
    total_rows INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    error_report TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    committed_at TEXT
);

-- 21. Excel Import Rows
CREATE TABLE IF NOT EXISTS excel_import_rows (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES excel_import_jobs(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    pno TEXT NOT NULL,
    raw_data TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('VALID', 'INVALID', 'IMPORTED')),
    error_message TEXT
);

-- 22. Import Rollback Snapshots
CREATE TABLE IF NOT EXISTS import_rollback_snapshots (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES excel_import_jobs(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    previous_state_json TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 23. Audit Events (Append-only)
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    actor_pno TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    district_scope TEXT,
    before_state_json TEXT,
    after_state_json TEXT,
    ip_address TEXT,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_district ON audit_events(district_scope);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_events(created_at DESC);

-- 24. Backup Jobs (6-hour auto schedule tracking)
CREATE TABLE IF NOT EXISTS backup_jobs (
    id TEXT PRIMARY KEY,
    triggered_by TEXT NOT NULL DEFAULT 'SYSTEM_CRON',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SUCCESS', 'FAILED')),
    checksum TEXT,
    storage_path TEXT,
    d1_records_count INTEGER,
    r2_files_count INTEGER,
    error_log TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_backup_time ON backup_jobs(created_at DESC);
