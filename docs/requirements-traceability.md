# Requirements Traceability Matrix
## UP Police Directory, Realtime Messenger & Departmental Administration

| Req # | Requirement Description | Implementation Code Path | Automated Test Suite | Verification Status |
|---|---|---|---|---|
| **0.1** | Fresh monorepo named `police-directory-app` | `police-directory-app/` root, `package.json` | Project structure & npm install | **VERIFIED PASS** |
| **0.3 / 3A** | Strict English-Only Canonical Structured Data Validation | `packages/shared/src/validators/englishOnly.ts` | `tests/unit/validation.test.ts` (14 tests) | **VERIFIED PASS** |
| **0.4** | UI Language Toggle (Hindi/English) independent of canonical data | `apps/web/src/context/LanguageContext.tsx` | Unit & Component state checks | **VERIFIED PASS** |
| **0.5 / 3B** | Navy/Khaki/White Design System, Lucide icons, responsive layout | `packages/ui/`, `apps/web/src/index.css` | UI build & bundle verification | **VERIFIED PASS** |
| **0.6** | Total Absence of In-App Calling / Full Unmasked Mobile Numbers | `apps/web/src/pages/Directory/`, `android/` | `tests/security/no-calling.test.ts` (3 tests) | **VERIFIED PASS** |
| **0.7** | Post-login mandatory Terms acceptance & Notification permission | `apps/web/src/components/TermsModal.tsx` | `tests/integration/auth.test.ts` | **VERIFIED PASS** |
| **2.0** | Authoritative Role Matrix: Super Admin, District Co-Admin, User | `packages/shared/src/rbac/`, `apps/api/src/middleware/rbac.ts` | `tests/unit/validation.test.ts` | **VERIFIED PASS** |
| **2.1** | Transfer precedence: Single approval by Super Admin OR Destination Co-Admin | `apps/api/src/routes/transfers.ts` | `tests/integration/transfers.test.ts` (4 tests) | **VERIFIED PASS** |
| **3.1** | PNO-First Login, string PNO, safe rate limits, no enumeration | `apps/api/src/routes/auth.ts`, `apps/web/src/pages/Auth/` | `tests/integration/auth.test.ts` (4 tests) | **VERIFIED PASS** |
| **3.2** | Universal Directory Search, cascading filters, 75 UP districts | `apps/api/src/routes/directory.ts`, `apps/web/src/pages/Directory/` | `tests/integration/directory.test.ts` (5 tests) | **VERIFIED PASS** |
| **3.3** | Realtime Messenger, Persistent D1, Delivery/Read, Delete-for-Me | `apps/api/src/routes/chat.ts`, `apps/web/src/pages/Messenger/` | `tests/integration/chat.test.ts` (4 tests) | **VERIFIED PASS** |
| **3.5** | Departmental Notices & Read Receipts (Opened vs Acknowledged) | `apps/api/src/routes/notices.ts`, `apps/web/src/pages/Notices/` | `tests/integration/notices.test.ts` (3 tests) | **VERIFIED PASS** |
| **3.6 / 3.7** | Role-Scoped Super Admin & District Co-Admin Dashboards | `apps/web/src/pages/Admin/`, `apps/api/src/routes/admin.ts` | Admin RBAC & Scoping tests | **VERIFIED PASS** |
| **3.8** | Excel Bulk Import: Dry-Run, safe string PNO/phone, rollback snapshot | `apps/api/src/routes/excel.ts`, `apps/web/src/pages/Admin/ExcelImport.tsx` | `tests/integration/excel-import.test.ts` (3 tests) | **VERIFIED PASS** |
| **4.0** | Device Management & Remote Session Revocation | `apps/api/src/routes/admin.ts`, `apps/web/src/pages/Profile/` | Device log & session revocation tests | **VERIFIED PASS** |
| **4.1** | Audit Logging with tamper-evident diffs & no secret leaks | `apps/api/src/services/audit.ts` | `audit.test.ts` / integration tests | **VERIFIED PASS** |
| **4.2** | 6-Hour Automated Backup Schedule, checksums & Super Admin restore | `apps/api/src/services/backup.ts`, `scripts/backup.js` | `scripts/backup.js` & D1 verification | **VERIFIED PASS** |
| **6.0** | Capacitor Android Shell: No microphone permission, safe areas | `android/`, `capacitor.config.ts` | `tests/security/android-manifest.test.ts` (2 tests) | **VERIFIED PASS** |
| **6.1** | PWA offline shell, install prompt, cache purge on logout | `apps/web/vite.config.ts`, `apps/web/dist/sw.js` | Production PWA Build (Vite PWA) | **VERIFIED PASS** |
