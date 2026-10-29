# Excel Bulk Ingestion & Rollback Specification
## UP Police Directory & Administration

### 1. The 6-Stage Bulk Ingestion Pipeline

To prevent data corruption, leading zero truncation, or unauthorized cross-district modifications, bulk ingestion follows a strict 6-stage lifecycle:

```
[Stage 1: File Selection]
       │
       ▼
[Stage 2: Strict Text Parsing (Preserve PNO string & leading zeros)]
       │
       ▼
[Stage 3: Shared Zod Schema Validation & Master FK Resolution]
       │
       ▼
[Stage 4: Mandatory Dry-Run Diff Preview (Summary counts: Created, Updated, Invalid)]
       │
       ▼
[Stage 5: Explicit Admin Confirmation & Transactional Upsert with Rollback Snapshots]
       │
       ▼
[Stage 6: Post-Commit Verification & Audit Trail Generation]
```

---

### 2. Header and Column Contract

The Excel spreadsheet must use **English headers only**:

| Column Name | Expected Format | Validation Rule |
|---|---|---|
| `PNO` | Text string (6-12 digits) | Preserves leading zeros. Rejects scientific notation `1.23E+07`. |
| `Name` | Text string (ASCII) | English letters, spaces, hyphens, dots only. Rejects Devanagari. |
| `Post` | Text string | Must match approved Designation master name or short name. |
| `District` | Text string | Must match one of 75 official UP revenue districts. |
| `Office` | Text string | Must match verified Station/Office under that district. |
| `Phone` | Text string (10 digits) | Exactly 10 ASCII digits starting with 6, 7, 8, or 9. |
| `WhatsApp` | Text string (optional) | 10 ASCII digits if provided. |
| `Email` | Text string (optional) | Valid ASCII email address. |
| `Status` | `ACTIVE`, `INACTIVE`, `PENDING` | Default `ACTIVE`. |
| `Remarks` | Text string (ASCII) | ASCII printable characters only. |

*Columns `Password` and `Hide_Phone` are strictly disallowed. Files containing these columns will be immediately rejected during Stage 1.*

---

### 3. Snapshot-Based Batch Rollback

During Stage 5 commit:
1. For every updated personnel record, the full prior row JSON is stored in `import_rollback_snapshots` keyed by `job_id`.
2. For newly inserted records, a snapshot record with `previous_state_json = NULL` is recorded.
3. If an admin invokes `/api/admin/excel/rollback`, the system restores prior values and deletes newly inserted records, returning the database to its exact pre-import state.
