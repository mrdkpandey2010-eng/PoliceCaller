# Architecture & Engineering Decisions Record (ADR)
## UP Police Directory, Realtime Messenger & Departmental Administration

### Decision 1: Monorepo Architecture & Package Management
- **Context:** Clean monorepo needed containing Web + PWA, Cloudflare Workers API, shared packages, D1 migrations, Capacitor Android shell, and test suites.
- **Decision:** Use npm workspaces (`apps/*`, `packages/*`) with shared TypeScript configurations. `packages/shared` houses types, Zod schemas, role matrices, and English-only validators to ensure 100% boundary uniformity between client and server.

### Decision 2: English-Only Canonical Data Ingestion Policy
- **Context:** Non-uniform script entries (e.g. Hindi/Devanagari, mixed scripts, emojis) cause search corruption, SMS/notification delivery failures, and identity ambiguities across statewide records.
- **Decision:** Strictly enforce canonical ASCII Latin values (`A-Z a-z`, digits for PNO/phone, specific allowed punctuation for names like `O'Neil`, `A.K. Singh`) for all structured identity and master fields. Reject any non-Latin or Devanagari input with explicit inline validation errors. Client-side, server-side (Workers), and Excel bulk import enforce identical Zod validation rules. Hindi UI localization remains independent and does not alter canonical storage. Chat messages and notice bodies are exempt and support full Unicode/Hindi.

### Decision 3: No In-App Calling Architecture
- **Context:** Project specifications strictly prohibit in-app calling, WebRTC, microphone permissions, call timers, dialers, or calling tabs. Mobile numbers must be visible to all approved active personnel without masking or permission requests.
- **Decision:** Completely exclude WebRTC libraries, STUN/TURN configs, microphone permissions in Android manifest/web permissions, and calling UI elements. The contact directory displays the complete, unmasked 10-digit mobile number with quick-copy functionality and external tel/WhatsApp link triggers where appropriate, but no in-app voice/video dialer.

### Decision 4: Authorization, Role Matrix & Single-Approver Transfer Precedence
- **Context:** Roles: `SUPER_ADMIN`, `DISTRICT_CO_ADMIN`, `USER`. Transfer approval ambiguity must be settled securely.
- **Decision:** As specified in the authoritative role matrix, transfer approval requires a single authorization from either `SUPER_ADMIN` OR the **Destination District** `DISTRICT_CO_ADMIN`. The Source District Co-Admin is strictly forbidden from approving transfers out of their district (preventing unauthorized outflow approvals). All server-side requests enforce district-scoped checks using cryptographically verified session claims rather than client-supplied parameters.

### Decision 5: Realtime Messenger & Delete-for-Me Architecture
- **Context:** High-concurrency chat with WebSocket/Durable Objects, persistent message delivery, and per-user message deletion without global data loss.
- **Decision:** Messages are assigned a client UUID and a monotonic server sequence number. Delivery and read receipts are tracked per participant. Message deletion uses a `user_message_visibility` tombstone table; "Delete for Me" hides the message solely for the requesting user while preserving it for the counterparty or group members.

### Decision 6: Excel Dry-Run, Safe String Coercion & Batch Rollback
- **Context:** Bulk import of police records frequently corrupts leading zeros in PNO or phone numbers through Excel scientific notation auto-formatting.
- **Decision:** The import engine mandates a 6-stage pipeline: (1) Parse with explicit string enforcement, (2) Validate against shared Zod schemas, (3) Dry-run diff preview with counts, (4) Explicit admin confirmation, (5) Chunked transactional commit with pre-import snapshot storage, and (6) Post-commit verification. Any batch can be safely rolled back using stored rollback snapshots. Passwords and `Hide_Phone` columns are strictly excluded.
