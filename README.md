# UP Police Directory, Realtime Messenger & Administration Portal

Official, modern, responsive Web, PWA, and Android application for Uttar Pradesh Police personnel directory, secure realtime departmental messaging, circular/order distribution, and role-scoped administration across all 75 districts.

---

## 🛡️ Key Features

- **Strict English-Only Canonical Data Ingestion:** All names, PNOs, phone numbers, designations, districts, and stations accept ASCII Latin characters only. Rejects Devanagari/Hindi and foreign scripts with field-specific errors.
- **Bilingual Independent UI:** Full Hindi/English UI display toggle. Localized labels never mutate canonical English records. Hindi is supported in chat messages and notice bodies.
- **Zero In-App Calling Architecture:** Complete absence of WebRTC, audio recording permissions, calling APIs, or call timers. Full unmasked 10-digit mobile numbers are displayed directly to all approved active personnel.
- **Authoritative Role-Based Access Control:**
  - `SUPER_ADMIN`: Statewide jurisdiction, Co-Admin management, master data controls, 6-hour backup configuration.
  - `DISTRICT_CO_ADMIN`: Scoped to assigned district. Can approve transfers *into* their district.
  - `USER`: Directory search, favorites, direct & group messaging, transfer requests.
- **Transfer Approval Precedence:** Single authorization by Super Admin OR Destination District Co-Admin. Source Co-Admin is strictly blocked from outflow approvals.
- **Realtime Departmental Messenger:** Persistent delivery with monotonic sequence numbering, receipts (sent, delivered, read), and per-user "Delete for Me" visibility tombstones.
- **6-Stage Excel Bulk Import & Rollback:** Header validation, safe string handling for PNO/phone, mandatory dry-run diff preview, and snapshot-based batch rollback.
- **Automated 6-Hour Cloud Backup:** Regular D1 relational snapshots with SHA-256 integrity checksums and R2 archive logging.
- **Native Android & PWA:** Capacitor Android shell with zero microphone permissions, plus installable PWA with offline caching.

---

## 📁 Repository Structure

```
police-directory-app/
├── apps/
│   ├── api/                 # Cloudflare Workers API Gateway (Hono + D1 + R2)
│   └── web/                 # React 19 + Vite + TypeScript PWA
├── packages/
│   ├── shared/              # Zod schemas, English-only validators, RBAC rules
│   └── ui/                  # Reusable design tokens, buttons, search, contact rows
├── db/
│   ├── migrations/          # D1 initial schema (0001_initial_schema.sql)
│   └── seeds/               # Verified 75 UP districts, designations & initial policy
├── android/                 # Capacitor Android native project shell
├── tests/
│   ├── unit/                # Strict English validation & RBAC unit tests
│   ├── integration/         # Auth, Directory, Transfers, Chat, Notices, Excel tests
│   └── security/            # Zero calling & Android manifest compliance tests
├── scripts/
│   ├── migrate.js           # D1 database migration runner
│   ├── seed.js              # Synthetic development personnel seeder
│   ├── backup.js            # 6-Hour scheduled backup execution runner
│   └── verify.ps1           # Windows PowerShell test gate verification suite
├── docs/                    # Architecture, RBAC, API, Threat Model, QA reports
├── .github/workflows/       # Continuous Integration pipeline
├── capacitor.config.ts      # Capacitor configuration
├── package.json             # Root monorepo workspace configuration
└── README.md
```

---

## 🚀 Quickstart & Verification (Windows 11)

### 1. Install Dependencies
```powershell
npm install
```

### 2. Apply Migrations & Seed Synthetic Development Personnel
```powershell
node scripts/migrate.js
node scripts/seed.js
```

### 3. Run Automated Tests & Test Gate
```powershell
# Run full Vitest suite (42 tests)
npx vitest run

# Run complete PowerShell verification gate
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

### 4. Start Development Servers
```powershell
# Start Web frontend (Vite dev server)
npm run dev --workspace=@police-directory/web
```

---

## 👤 Development Fixtures & Credentials

*Synthetic personnel fixtures for local development only:*
- **Super Admin:** PNO `00000001` / Password: `SuperAdmin@2026`
- **Lucknow District Co-Admin:** PNO `00000002` / Password: `CoAdmin@2026`
- **Varanasi District Co-Admin:** PNO `00000003` / Password: `CoAdmin@2026`
- **Regular Officer (Lucknow):** PNO `00112233` / Password: `PoliceUser@2026`
