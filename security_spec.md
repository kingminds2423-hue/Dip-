# Security Specification for DIP BHOLA NETWORK

## 1. Zero-Trust Identity & RBAC Architecture
- **Bootstrapped Director / Super Admin**: `zahidulislam53330@gmail.com` with `request.auth.token.email_verified == true` OR presence of `/admins/{request.auth.uid}`. Has full administrative access to company settings, `/settings/auth`, role approvals (`/users`), partners, staff, financials, customers, complaints, and audit logs.
- **Approved Roles (`/users/{uid}` where `status == 'approved'`)**:
  - `director` / `admin`: Full access across all collections.
  - `manager`: Approved branch/general manager (`status == 'approved'`). Can read/manage staff, partners, transactions, customerDues, customers, complaints, joinRequests, and view non-secret settings. Cannot read/write `/settings/auth`, cannot elevate `/users` roles, cannot delete audit logs or admin markers.
  - `staff`: Approved technician / field staff (`status == 'approved'`). Can view approved shared company directory (`companies/dip-bhola-network`, non-secret settings, `staffs`, `customers`, `customerDues`, `complaints`, `transactions`), create valid `transactions` / `complaints` / `customers` / `customerDues`, and update ONLY complaint status/resolution fields (`['status', 'resolutionNote', 'resolvedAt', 'updatedAt']`) or due collection updates (`['paidAmount', 'currentDue', 'notes', 'updatedAt']`). Cannot access `partners`, `/settings/auth`, `auditLogs`, `joinRequests` list, or delete ledger/complaint records.
  - `partner`: Approved equity share partner (`status == 'approved'`). Read-only access to `partners`, `transactions` (for profit/ratio visibility), `companies/dip-bhola-network`, and non-secret settings. Strictly read-only — cannot write/edit/delete business data.
- **Pending / Unapproved Users (`status == 'pending' | 'rejected'`)**:
  - Can read/create/update only their own `/users/{request.auth.uid}` profile (non-privileged fields only; `role == 'pending'` and `status == 'pending'` enforced on creation).
  - Can submit a single pending `/joinRequests/{requestId}` tied to `uid == request.auth.uid`, and read their own joinRequest.
  - **Zero access** to company ledger, customers, dues, complaints, staffs, partners, or settings.

## 2. Data Invariants
1. **Default-Deny Catch-All**: `match /{document=**} { allow read, write: if false; }` precedes all collection rules.
2. **Verified Auth Mandate**: Every authenticated rule requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Anti-Self-Assigned Privilege Escalation**: A non-admin creating `/users/{uid}` is strictly locked to `uid == request.auth.uid && role == 'pending' && status == 'pending'` and cannot create `/admins/{uid}` unless matching the verified bootstrapped email `zahidulislam53330@gmail.com`.
4. **Immutable User & Transaction Ownership**: `uid` and `createdAt` on `/users/{uid}`, `uid` on `/joinRequests/{requestId}`, and `addedByUid` on `/transactions/{transactionId}` cannot be reassigned on update.
5. **Sensitive Doc & PII Isolation**:
   - `/settings/auth` (`adminPin`, `adminPhone`) is readable and writable **only** by `isAdmin()`.
   - `/users/{userId}` PII (`email`, `phone`) is readable **only** by the owner (`request.auth.uid == userId`) or `isAdmin()`.
   - `/partners/{partnerId}` (`nidNumber`, `nidPhotoUrl`, investment equity) is inaccessible to `staff` or `pending` users.
6. **Immutable Audit Trail**: `/auditLogs/{logId}` denies all `update` and `delete` (`if false;`), and `get`/`list` is restricted strictly to `isAdmin()`.
7. **Tiered Updates via `affectedKeys().hasOnly(...)`**: Non-admin `staff` updates on `/complaints/{complaintId}` and `/customerDues/{dueId}` are constrained strictly to whitelisted operational keys and re-run `isValidComplaint` / `isValidCustomerDue` validators.
8. **Strict Size & ID Validation**: Every path ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars) via `isValidId()` on single-document ops (`get`, `create`, `update`, `delete`), and every string/list field enforces bounded `.size()`.
9. **Capability-Token Scannable Report Snapshots**: `/sharedReports/{reportId}` allows single-document `get` ONLY when `reportId` matches `^[a-zA-Z0-9_\-]+$` and `reportId.size() >= 20` (non-enumerable capability token). `allow list: if false;` prevents collection enumeration, and snapshots exclude personal PII. Writes are allowed only to approved users (`director`, `admin`, `manager`, `staff`).

## 3. "Dirty Dozen" Adversarial Test Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Ledger Read**: `GET /transactions` with `auth = null` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof**: `GET /settings/auth` with `auth.token = { email: 'zahidulislam53330@gmail.com', email_verified: false }` -> `PERMISSION_DENIED`.
3. **Self-Assigned Director Role on Signup**: `CREATE /users/attackerUid` with `{ uid: 'attackerUid', email: 'attacker@gmail.com', displayName: 'Attacker', role: 'director', status: 'approved', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }` -> `PERMISSION_DENIED`.
4. **Admin Marker Forgery**: `CREATE /admins/attackerUid` by non-bootstrapped email -> `PERMISSION_DENIED`.
5. **User Role Escalation on Profile Update**: `UPDATE /users/staffUid` by `staffUid` changing `{ role: 'director', status: 'approved' }` -> `PERMISSION_DENIED`.
6. **Pending User Reading Customer Directory**: `LIST /customers` by signed-in user whose `/users/{uid}` has `status: 'pending'` -> `PERMISSION_DENIED`.
7. **Staff Reading Director PIN (`/settings/auth`)**: `GET /settings/auth` by an approved `staff` -> `PERMISSION_DENIED`.
8. **Partner Mutating Ledger**: `CREATE /transactions/tx-evil` by an approved `partner` -> `PERMISSION_DENIED`.
9. **Staff Deleting Ledger / Shadow Field Injection**: `CREATE /transactions/tx-1` by approved `staff` with negative amount `-500` or shadow key `isAdminBypass: true` -> `PERMISSION_DENIED`.
10. **Staff Unauthorized Complaint Field Edit**: `UPDATE /complaints/cmp-1` by approved `staff` modifying `assignedStaffId` or `complainDetails` (outside `['status', 'resolutionNote', 'resolvedAt', 'updatedAt']`) -> `PERMISSION_DENIED`.
11. **Audit Log Tampering**: `UPDATE /auditLogs/audit-1` or `DELETE /auditLogs/audit-1` even by an admin -> `PERMISSION_DENIED`.
12. **ID Poisoning, SharedReport Enumeration & Resource Exhaustion**: `CREATE /transactions/bad$id..with..slash`, `LIST /sharedReports`, or `10KB` title string -> `PERMISSION_DENIED`.
