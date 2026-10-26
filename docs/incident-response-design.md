# LeakLens Incident Response & Remediation Subsystem Design

---

## 1. Domain Architecture & Relational Entities

The incident subsystem coordinates triage, response, containment, and auditability across 4 primary database entities:

```
[ findings ] <------ (many-to-many) ------> [ incident_findings ] 
                                                   |
                                                   v
[ users ] <--------------------------------- [ incidents ]
   ^                                               |
   |                                               |
   +--------- [ remediation_actions ] <------------+
   |                        |
   +--------- [ audit_logs ] <---------------------+
```

### 1.1 Relational Integrity Rules
- **`incidents`**: Central entity tracking issue triage state, priority, assignees, timestamps, resolution summary, and optimistic concurrency `version`.
- **`incident_findings`**: Strict composite primary key `(incident_id, finding_id)`. Prevents duplicate links. Cascade on incident deletion; `NO ACTION` on finding deletion to prevent accidental orphaned data loss.
- **`remediation_actions`**: Operational history entries. Records actor ID, timestamp, action type, notes, and previous/new state.
- **`audit_logs`**: System-level immutable security ledger. Writes are executed in the same database transaction as the business operation.

---

## 2. Transaction Boundaries & Atomicity

### 2.1 Incident Creation
```
BEGIN TRANSACTION;
  1. INSERT INTO leaklens.incidents (...);
  2. For each finding_id:
       INSERT INTO leaklens.incident_findings (incident_id, finding_id, linked_at);
       UPDATE leaklens.findings SET status = 'confirmed' WHERE finding_id = @id;
  3. INSERT INTO leaklens.remediation_actions (action_type='STATUS_CHANGE', notes='Incident created');
  4. INSERT INTO leaklens.audit_logs (event_type='INCIDENT_CREATED', ...);
COMMIT TRANSACTION;
```
If any step fails (e.g., finding does not exist, constraint violation, or duplicate key), `ROLLBACK TRANSACTION` is triggered. No orphaned incident or partial association can persist.

### 2.2 Stored Procedure: `sp_resolve_incident`
The resolution workflow is implemented as an atomic SQL Server stored procedure with `SET XACT_ABORT ON` and `BEGIN TRY ... BEGIN CATCH`:
1. **Validation:** Checks that the acting user exists and is active. Checks that the incident exists and is currently in `IN_PROGRESS` or `PENDING_VERIFICATION`.
2. **Concurrency Verification:** Validates that `@expected_version` matches `incidents.version`. If mismatched, throws error `50005` (concurrency conflict).
3. **Incident Update:** Status set to `RESOLVED`, `resolved_at = SYSUTCDATETIME()`, `resolution_summary = @notes`, `version = version + 1`.
4. **Action Logging:** Inserts record into `remediation_actions` with `action_type = 'RESOLUTION'`.
5. **Finding Cascading:** Updates all associated findings in `leaklens.findings` to `status = 'remediated'`.
6. **Audit Trail:** Inserts security audit record into `leaklens.audit_logs` with `event_type = 'incident_resolved'` and JSON metadata.
7. **Rollback Guarantee:** Any SQL error rolls back all table updates atomically.

---

## 3. Optimistic Concurrency Control

To prevent lost updates in multi-analyst security operations centers:
- Each incident record includes an integer column: `version INT NOT NULL DEFAULT 1`.
- When an analyst loads an incident, `version` is provided in the payload.
- State mutations (assignment, status change, resolution) include `expected_version` in the update predicate:
  ```sql
  UPDATE leaklens.incidents
  SET status = @new_status, version = version + 1, updated_at = SYSUTCDATETIME()
  WHERE incident_id = @incident_id AND version = @expected_version;
  ```
- If `@@ROWCOUNT = 0`, a concurrent modification occurred. The backend rejects the request with `HTTP 409 Conflict`, prompting the client to refresh and review the updated timeline.

---

## 4. API Endpoints Contract

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/api/incidents` | `GET` | All | Paginated list with filters (`status`, `priority`, `assigned_to`). |
| `/api/incidents` | `POST` | `ADMIN`, `ANALYST` | Create incident with finding associations. |
| `/api/incidents/metrics` | `GET` | All | Incident summary aggregates. |
| `/api/incidents/unassociated-findings`| `GET` | `ADMIN`, `ANALYST` | Findings eligible for incident association. |
| `/api/incidents/:id` | `GET` | All | Incident details, findings list, and remediation timeline. |
| `/api/incidents/:id` | `PATCH`| `ADMIN`, `ANALYST` | Update safe title or description. |
| `/api/incidents/:id/assignment` | `PATCH`| `ADMIN`, `ANALYST` | Assign or reassign incident to eligible user. |
| `/api/incidents/:id/status` | `PATCH`| `ADMIN`, `ANALYST` | Request validated lifecycle status transition. |
| `/api/incidents/:id/actions` | `POST` | `ADMIN`, `ANALYST` | Record investigation note or remediation step. |
| `/api/incidents/:id/resolve` | `POST` | `ADMIN`, `ANALYST` | Execute atomic resolution via `sp_resolve_incident`. |
| `/api/incidents/:id/reopen` | `POST` | `ADMIN`, `ANALYST` | Reopen resolved or closed incident with justification. |
| `/api/incidents/:id/findings` | `POST` | `ADMIN`, `ANALYST` | Associate additional findings. |
| `/api/incidents/:id/findings/:findingId`| `DELETE`| `ADMIN`, `ANALYST`| Disassociate a finding from incident. |

---

## 5. Security & Privacy Guarantees

1. **Zero Secret Persistence in Incident Records:**
   - Incident descriptions, titles, remediation notes, and audit metadata strictly prohibit raw secret inclusion.
   - Associated findings display only pre-masked excerpts (e.g. `ghp_***_890`).
2. **Actor Authentication from Trusted Context:**
   - `acting_user_id` is extracted strictly from the verified JWT payload, never accepted from request body or query parameters.
3. **Audit Immutability:**
   - No `UPDATE` or `DELETE` API endpoints exist for `audit_logs` or `remediation_actions`.
