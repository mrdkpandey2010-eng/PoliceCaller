# Deployment & Cloudflare Infrastructure Guide
## UP Police Directory & Realtime Messenger

### 1. Cloudflare Architecture Overview

The system runs on the Cloudflare developer platform:
- **Cloudflare Workers:** Edge API Gateway executing Hono framework.
- **Cloudflare D1:** Canonical relational SQLite database.
- **Cloudflare R2:** Private object storage for personnel photos and encrypted backups.
- **Cloudflare Pages / Workers Sites:** Static web hosting for React 19 PWA bundle.
- **Cloudflare Cron Triggers:** Automated 6-hour backup job execution.

---

### 2. Wrangler Configuration (`wrangler.toml`)

Create `apps/api/wrangler.toml`:
```toml
name = "police-directory-api"
main = "src/index.ts"
compatibility_date = "2026-02-01"

[vars]
APP_ENV = "production"

[[d1_databases]]
binding = "DB"
database_name = "police_directory_prod"
database_id = "PLACEHOLDER_CLOUDFLARE_D1_DATABASE_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "police-private-storage"

[triggers]
crons = ["0 */6 * * *"]
```

---

### 3. Production Deployment Commands

```powershell
# 1. Apply D1 schema migrations to remote production database
npx wrangler d1 migrations apply police_directory_prod --remote

# 2. Deploy Worker API
cd apps/api
npx wrangler deploy

# 3. Deploy Frontend PWA to Cloudflare Pages
cd ../../apps/web
npm run build
npx wrangler pages deploy dist --project-name=police-directory-pwa
```
