# Security Threat Model & Governance
## UP Police Directory & Realtime Messenger

### 1. Threat Vectors & Countermeasures

| Threat Vector | Risk Description | System Countermeasure |
|---|---|---|
| **Unauthorized In-App Calling / Eavesdropping** | Risk of interception, unwanted voice streams, or unauthorized dialer usage. | **Complete Exclusion:** No WebRTC, no microphone permissions, no calling APIs, no audio recording capabilities in codebase or Android manifest. |
| **Horizontal Privilege Escalation (IDOR)** | District Co-Admin accessing or approving records outside assigned district. | **Server-Side District Scoping:** Session claims verified against D1 database on every request. Client cannot override `district_id`. |
| **Transfer Approval Bypass** | Source district admin attempting to push out transfers without destination consent. | **Single-Approver Rule:** Only Destination Co-Admin or Super Admin can approve. Source Co-Admin authorization attempts return 403. |
| **Session Hijacking / Stale Sessions** | Continued access after personnel deactivation or device compromise. | **Atomic Session Revocation:** Deactivating a user immediately flips `is_revoked = 1` for all active tokens and device records. |
| **Data Script Infiltration & Corruption** | Hindi/Devanagari characters or emojis entered into canonical PNO/names causing search index failure. | **Strict English-Only Canonical Enforcement:** Shared Zod schemas strictly permit ASCII Latin letters for names and digits for PNO/phones. |
| **Excel Scientific Notation Truncation** | Excel auto-formatting PNO or phone into `1.23E+07` leading to lost records. | **Strict Text Parsing & Dry-Run:** Headers validated, scientific notation rejected, dry-run diff preview mandatory before commit. |
| **Secret Leakage in Audit Trails** | Passwords or session tokens inadvertently printed in audit logs. | **Audit Redaction Layer:** `sanitizeForAudit` masks all password, token, and secret fields before writing to append-only logs. |

---

### 2. Encryption Standards

- **In-Transit:** TLS 1.3 enforced for all HTTPS and WebSocket connections.
- **At-Rest:** Cloudflare D1 encrypted at rest; Cloudflare R2 backup snapshots encrypted with AES-GCM; password hashes generated via `crypto.scrypt` with unique 16-byte cryptographically secure salts.
- **Token Security:** Bearer tokens are 256-bit random hex strings. The database stores only SHA-256 hashes (`token_hash`), ensuring plaintext tokens can never be recovered from database dumps.
