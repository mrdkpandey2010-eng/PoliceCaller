# Authenticated API Specification
## UP Police Directory & Departmental Administration

### Base URL: `/api`

### 1. Authentication & Session
- `POST /api/auth/register`
  - Body: `{ pno, fullName, designationId, districtId, stationOfficeId, mobile, whatsapp?, email?, password }`
  - Strict English canonical validation. Returns `status: PENDING`.
- `POST /api/auth/login`
  - Body: `{ pno, password, platform?, deviceName? }`
  - Returns: `{ success: true, token, user: { ... } }`
- `POST /api/auth/logout`
  - Revokes current Bearer session and device session.
- `GET /api/auth/me`
  - Returns authenticated context, permissions, and `needsTermsAcceptance`.
- `POST /api/auth/terms/accept`
  - Records mandatory policy version acceptance.
- `POST /api/auth/notification-pref`
  - Body: `{ status: 'GRANTED' | 'DENIED' | 'UNSUPPORTED' }`

---

### 2. Personnel Directory
- `GET /api/directory`
  - Query params: `q` (Name, PNO, Phone, District, Station, Designation), `districtId`, `stationId`, `designationId`, `favorites`, `limit`, `offset`.
  - Default view prioritizes user's assigned station/office.
  - Returns full unmasked 10-digit mobile numbers for all approved personnel.
  - Disallows any calling or number hiding features.
- `POST /api/directory/favorites/:targetUserId/toggle`
  - Adds or removes user from personal favorites list.
- `GET /api/directory/recent-searches`
  - Returns user's recent search queries.
- `DELETE /api/directory/recent-searches`
  - Clears personal search history.

---

### 3. Departmental Transfers
- `POST /api/transfers`
  - Body: `{ destinationDistrictId, destinationStationId, reason, orderReference? }`
  - Creates pending transfer request.
- `GET /api/transfers`
  - Super Admin sees statewide, Co-Admin sees transfers into/out-of district, User sees own requests.
- `POST /api/transfers/review`
  - Body: `{ transferId, action: 'APPROVE' | 'REJECT', rejectionReason? }`
  - Authorized approver: Super Admin OR Destination Co-Admin only.

---

### 4. Realtime Messenger
- `GET /api/chat/conversations`
  - Returns active conversations with last message preview and unread count.
- `POST /api/chat/conversations`
  - Body: `{ type: 'DIRECT' | 'GROUP', participantId?, groupTitle?, memberIds? }`
- `GET /api/chat/messages/:conversationId`
  - Returns message history excluding user's "Delete for Me" tombstones.
- `POST /api/chat/messages`
  - Body: `{ conversationId, content, messageType? }`
  - Supports Hindi and English text, emoji, attachments.
- `POST /api/chat/messages/:messageId/delete-for-me`
  - Creates per-user tombstone; preserves message for counterparty.

---

### 5. Orders & Notices
- `GET /api/notices`
  - Returns active circulars targeted at user's role or district.
- `POST /api/notices`
  - Body: `{ title, body, urgency, targetScope, targetDistrictId? }`
- `POST /api/notices/:noticeId/read`
  - Records first-read timestamp receipt.
- `POST /api/notices/:noticeId/acknowledge`
  - Records formal departmental acknowledgment receipt.
- `GET /api/notices/:noticeId/report`
  - Read & acknowledgment statistics report.

---

### 6. Administration & Bulk Operations
- `GET /api/admin/metrics` - Real dashboard counts.
- `GET /api/admin/pending-users` - Registrations pending approval.
- `POST /api/admin/review-user` - Approve / Reject user.
- `GET /api/admin/users` - User management list.
- `POST /api/admin/users/:userId/status` - Activate / Deactivate user (immediate session revocation).
- `POST /api/admin/users/:userId/reset-password` - Admin password reset.
- `POST /api/admin/excel/dry-run` - 6-stage import step 1-3.
- `POST /api/admin/excel/commit` - Commit import with rollback snapshots.
- `POST /api/admin/excel/rollback` - Revert batch using snapshots.
- `GET /api/admin/backup/status` - 6-hour backup schedule health.
- `POST /api/admin/backup/trigger` - Manual backup execution.

---

### 7. Master Data
- `GET /api/masters/districts` - All 75 UP revenue districts.
- `GET /api/masters/stations?districtId=...` - Stations for district.
- `GET /api/masters/designations` - Hierarchical designations list.
- `GET /api/masters/policies?type=TERMS` - Active versioned terms.
