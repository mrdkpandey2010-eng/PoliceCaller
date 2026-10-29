# Architecture & System Design
## UP Police Directory, Realtime Messenger & Departmental Administration

### 1. High-Level System Architecture

The application is structured as a modern, high-performance monorepo serving Web, PWA, and Android Capacitor platforms with Cloudflare edge backend infrastructure:

```
+-------------------------------------------------------------------------------+
|                                CLIENT LAYER                                   |
|   +-----------------------+  +-----------------------+  +------------------+  |
|   |  React 19 Web Client  |  |   PWA Offline Shell   |  | Capacitor Native |  |
|   |   (Vite + Tailwind)   |  | (Service Worker Cache)|  |  Android (Java)  |  |
|   +-----------------------+  +-----------------------+  +------------------+  |
+-------------------------------------------------------------------------------+
                                        | (HTTPS / WSS)
+-------------------------------------------------------------------------------+
|                            CLOUDFLARE WORKERS API                             |
|   - Authentication Middleware & District-Scoped RBAC Enforcement              |
|   - Strict English-Only Canonical Zod Validation Layer                        |
|   - Versioned Routes: /auth, /directory, /transfers, /chat, /notices, /admin   |
|   - 6-Hour Scheduled Cron Trigger Backup Engine                               |
+-------------------------------------------------------------------------------+
                 |                                      |
+------------------------------------+   +------------------------------------+
|     Cloudflare D1 (SQLite)         |   |      Cloudflare R2 (Storage)       |
|  - Canonical Relational Store      |   |  - Encrypted 6-Hour Backups        |
|  - 75 Verified UP Districts Master |   |  - Private Departmental Media      |
|  - Realtime Sequence & Tombstones  |   |  - Audit Log Snapshots             |
+------------------------------------+   +------------------------------------+
```

### 2. Core Modules

1. **Shared Contract (`packages/shared`)**:
   - `EnglishNameSchema`, `PnoSchema`, `MobileSchema`, `ExcelRowSchema`.
   - Comprehensive RBAC matrix and role definitions.
   - Guaranteed identical validation logic on browser and edge server.

2. **UI Design System (`packages/ui`)**:
   - Premium palette: Deep Navy `#10243B`, Primary Navy `#17324F`, Restrained Teal `#147D84`, Subtle Khaki `#C3A35E`.
   - Accessible buttons and icons (minimum 44px touch targets).
   - Universal search bar, contact rows with unmasked mobile numbers, chat bubbles, and mobile bottom navigation.
   - Total exclusion of calling UI, WebRTC, dialers, or hide-number toggles.

3. **Backend API Gateway (`apps/api`)**:
   - Hono application compiling to Cloudflare Workers edge runtime.
   - Pluggable D1 database adapter (`LocalD1Database` for zero-latency local development/testing with Node 24 `node:sqlite`).
   - Append-only audit logging and 6-hour backup scheduler.

4. **Web & PWA (`apps/web`)**:
   - React 19 single-page application with bilingual UI toggle (English / Hindi).
   - Client-side Excel parsing (XLSX) for instant dry-run previews.
   - Service worker with cache purge on logout.

5. **Android Native (`android/`)**:
   - Capacitor Android shell targeting Android API 34.
   - Safe area handling and hardware back button integration.
   - Zero microphone or calling permissions in `AndroidManifest.xml`.
