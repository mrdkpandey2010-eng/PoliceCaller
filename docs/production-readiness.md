# Production Readiness & External Prerequisite Checklist
## UP Police Directory & Realtime Messenger

### 1. Locally Verified Components (Verified Ready)
- [x] **Monorepo Architecture:** Clean, modular structure (`apps/web`, `apps/api`, `packages/shared`, `packages/ui`, `android`, `tests`).
- [x] **Strict English-Only Validation:** Comprehensive Zod schemas rejecting Hindi/Devanagari on structured personnel fields while allowing Hindi in chat messages and notice bodies.
- [x] **Full 75-District Master Data:** Complete verified Uttar Pradesh official revenue districts seeded into D1 database.
- [x] **Zero In-App Calling Compliance:** Verified complete absence of WebRTC, microphone permissions, call timers, or phone masking.
- [x] **Authoritative RBAC Matrix:** Single-approver transfer rule (Destination Co-Admin OR Super Admin) verified with automated tests.
- [x] **Messenger with Delete-for-Me:** Per-user message visibility tombstones verified.
- [x] **Excel 6-Stage Bulk Ingestion:** Dry-run preview, scientific notation rejection, and snapshot-based rollback tested.
- [x] **6-Hour Automated Backup:** Tested D1 snapshot, SHA-256 integrity checksum, and ledger logging.
- [x] **PWA Production Build:** Web app and PWA assets successfully compiled.

---

### 2. External Prerequisites & Deployment Blockers

To deploy this application to live production, the following official credentials and authorizations are required from departmental authorities:

| Component | Required External Prerequisite | Status | Action Required |
|---|---|---|---|
| **Cloudflare Account ID & API Tokens** | Cloudflare Enterprise/Paid account access to bind remote D1 (`police_directory_prod`) and private R2 buckets. | **PENDING USER AUTHORIZATION** | Provide `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. |
| **Android Release Keystore** | Cryptographic `.keystore` / `.jks` and key alias to sign production APK/AAB for Google Play or departmental MDM. | **PENDING USER AUTHORIZATION** | Generate departmental production release keystore. |
| **FCM / Web Push Server Key** | Firebase Cloud Messaging project credentials for remote push delivery to devices when app is killed. | **PENDING CONFIGURATION** | Provide `FIREBASE_SERVER_KEY` or VAPID keys. |
| **Official Personnel Data** | Real statewide personnel database extract (synthetic fixtures currently used for dev/testing). | **PENDING EXPLICIT APPROVAL** | Obtain formal departmental sign-off prior to real data ingestion. |
