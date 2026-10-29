# Automated 6-Hour Backup & Disaster Recovery
## UP Police Directory & Departmental Administration

### 1. 6-Hour Automated Cadence

In accordance with requirement 4.2, automated cloud backups execute on a strict **6-hour cadence**:
- `00:00 UTC`
- `06:00 UTC`
- `12:00 UTC`
- `18:00 UTC`

Configured via Cloudflare Workers Cron Triggers (`crons = ["0 */6 * * *"]`) and testable locally via `node scripts/backup.js`.

---

### 2. Snapshot Archive & Checksum Verification

Every backup execution performs:
1. **D1 Relational Snapshot:** Consistent read of core personnel, master, and messaging tables.
2. **SHA-256 Checksum Generation:** Cryptographic digest generated over snapshot metadata and payload.
3. **Encrypted Archive Destination:** Uploaded to private R2 bucket path: `r2://police-backups/daily/YYYY-MM-DD/bk_<uuid>.enc`.
4. **Audit & Health Ledger:** Execution status, record counts, and checksum recorded in `backup_jobs` table.

---

### 3. Restoration Rehearsal & Security Controls

- **Super Admin Only:** Only users with `SUPER_ADMIN` role may trigger a restoration rehearsal or view global backup status.
- **Checksum Verification:** Prior to restoration rehearsal, the snapshot SHA-256 checksum is recalculated and compared against the recorded database digest.
- **Maintenance Mode:** Production restore requires explicit two-person authorization and puts the application into maintenance mode to prevent write split-brain.
