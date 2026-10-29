# Authoritative Role & Permissions Matrix
## UP Police Directory & Departmental Administration

### 1. Canonical Permission Matrix

| Capability | Super Admin | District Co-Admin | User |
|---|---|---|---|
| Self-register user | No | No | Yes |
| Reset user password | All users statewide | Assigned district users only | No admin reset |
| Reset Co-Admin password | Yes | No | No |
| Reset Super Admin password | Yes (controlled recovery) | No | No |
| Approve/reject user registration | Statewide | Assigned district only | No |
| Manage/edit users | Statewide | Assigned district only | No (permitted profile fields only) |
| Manage Co-Admins | Yes | No | No |
| Approve transfer | Yes (Statewide) | Destination district Co-Admin only | No |
| Request own transfer | Ordinary account workflow | Ordinary account workflow | Yes |
| Manage designations | Yes | No | No |
| Manage district names | Yes | No | No |
| Manage station/office master names | Yes | No | No |
| View/manage device management logs | Yes | No | Own active devices only |
| Configure 6-hour auto backup | Yes | No | No |
| Activate/deactivate users | Statewide | Assigned district only | No |
| Manage policies/custom links | Yes | No | No |
| Publish notices/orders | Any authorized target group | Own district users only | No |
| Direct and group chat | Yes | Yes | Yes |

---

### 2. Transfer Precedence Rule

**Business Rule:** A transfer request requires a **single authorization** by either:
1. `SUPER_ADMIN` (Statewide jurisdiction), OR
2. The **Destination District** `DISTRICT_CO_ADMIN` (the incoming receiving authority).

**Strict Enforcement:**
- The **Source District** Co-Admin is strictly forbidden from approving a transfer out of their district (prevents unauthorized posting leakages).
- Regular users cannot directly alter their posting.
- Once approved, the user's `district_id` and `station_office_id` are updated atomically in the relational database.

---

### 3. District Scoping & Session Security

- Every administrative route inspects the authenticated session claims stored in the database.
- A District Co-Admin attempting to pass a different `districtId` in query strings or JSON payloads receives an immediate HTTP `403 Forbidden`.
- Deactivating a user immediately invalidates all active sessions across web and mobile.
