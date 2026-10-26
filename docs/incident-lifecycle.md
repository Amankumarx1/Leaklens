# LeakLens Incident Lifecycle & State Transition Model

> **Defensive Security Governance:** This document defines the strict finite-state machine (FSM) governing security incidents in LeakLens. State transitions are verified and enforced in the server-side domain model and database layer to prevent unauthorized or inconsistent status mutations.

---

## 1. Incident Status Definitions

| Status | Identifier | Description | Default Entry State |
|---|---|---|:---:|
| **Open** | `OPEN` | Incident has been created from one or more detected findings and queued for triage. No active remediation has commenced. | Initial State |
| **In Progress** | `IN_PROGRESS` | An authorized analyst or administrator is actively investigating the exposure, analyzing scope, or executing remediation steps (e.g. key rotation, secret revocation). | Transition |
| **Pending Verification** | `PENDING_VERIFICATION` | Remediation actions have been completed by the response team. The incident awaits independent verification (e.g. confirmation that the key is revoked and git history scrubbed). | Transition |
| **Resolved** | `RESOLVED` | The exposure has been mitigated, verified, and confirmed. All linked findings are transitioned to `remediated`. | Terminal State |
| **Closed** | `CLOSED` | The incident is officially closed. Administrative closure after operational review or administrative dismissal (e.g., false positive or superseded exposure). | Terminal State |

---

## 2. Priority Classifications

| Priority | Identifier | SLA Guideline | Description |
|---|---|---|---|
| **Critical** | `CRITICAL` | 1 hour | Active exposure of cryptographic private keys, root administrative credentials, or multi-tenant database tokens. Immediate rotation and revocation required. |
| **High** | `HIGH` | 4 hours | High-privilege cloud API keys (e.g., AWS, GCP), production database passwords, or broad authorization tokens. |
| **Medium** | `MEDIUM` | 24 hours | Limited-scope API tokens, staging credentials, or internal identifier leaks. |
| **Low** | `LOW` | 72 hours | Low-risk tokens, internal test fixtures, or email exposure without associated credentials. |

---

## 3. Allowed Status Transitions & Permissions Matrix

All state transitions are validated against the current persisted incident record. Direct database updates or API requests attempting an unregistered transition are rejected with `HTTP 409 Conflict` or `HTTP 422 Unprocessable Entity`.

```
        +-----------------------------------------------+
        |                                               |
        v                                               | (Admin Reopen)
   [  OPEN  ] -------------> [ IN_PROGRESS ] <----------+
        |                          |    ^               |
        | (Admin Close)            |    | (Failed Verif)|
        v                          v    |               |
   [ CLOSED ] <----+         [ PENDING_VERIF ]          |
        ^          |               |                    |
        |          |               | (Verif Success)    |
        |          |               v                    |
        |          +------- [  RESOLVED  ] -------------+
        |                          |        (Reopen with Reason)
        +--------------------------+
               (Authorized Close)
```

| Current Status | Target Status | Required Actor Roles | Business Requirements & Rules |
|---|---|---|---|
| `OPEN` | `IN_PROGRESS` | `ADMIN`, `ANALYST` | User must be assigned or assign themselves; investigation commences. |
| `OPEN` | `CLOSED` | `ADMIN` only | Direct closure permitted only by administrators (e.g. invalid report, false alarm, duplicated ticket). Justification required. |
| `IN_PROGRESS` | `PENDING_VERIFICATION` | `ADMIN`, `ANALYST` | At least one remediation action must be recorded. Remediation notes must document actions taken. |
| `IN_PROGRESS` | `RESOLVED` | `ADMIN` only | Direct resolution from in-progress is restricted to administrators when formal verification is waived under documented policy. |
| `PENDING_VERIFICATION` | `IN_PROGRESS` | `ADMIN`, `ANALYST` | Verification failed (`FAILED` or `NEEDS_MORE_WORK`). Rationale must be recorded in remediation history. |
| `PENDING_VERIFICATION` | `RESOLVED` | `ADMIN`, `ANALYST` | Verification succeeded (`PASSED`). Verified via `sp_resolve_incident` atomic transaction. |
| `RESOLVED` | `CLOSED` | `ADMIN`, `ANALYST` | Operational review complete; incident officially retired. |
| `RESOLVED` | `IN_PROGRESS` | `ADMIN`, `ANALYST` | Reopening allowed if exposure recurs or post-incident review requires additional mitigation. Justification mandatory. |
| `CLOSED` | `IN_PROGRESS` | `ADMIN` only | Reopening a closed incident is restricted to administrators with mandatory justification. |

---

## 4. Remediation Action Types

Every activity, note, assignment, and status alteration is immutably recorded in the `remediation_actions` table:

1. `INVESTIGATION`: Findings analysis, scope discovery, and impact assessment notes.
2. `ASSIGNMENT`: Analyst assignment or reassignment records.
3. `STATUS_CHANGE`: System record of allowed lifecycle status progression.
4. `REMEDIATION`: Operational defensive actions taken (e.g. `secret_revocation`, `key_rotation`, `access_revocation`, `file_quarantine`).
5. `VERIFICATION`: Record of validation check and outcome (`PASSED`, `FAILED`, `NEEDS_MORE_WORK`).
6. `COMMENT`: General operational collaboration comment.
7. `RESOLUTION`: Final resolution entry created by `sp_resolve_incident`.
8. `REOPENED`: Record of reopening with justification.

---

## 5. Verification Workflow & Limitations

1. **Outcome Standards:**
   - `PASSED`: Analyst verified key revocation via provider CLI/API, validated key rotation, and confirmed secret is inactive.
   - `FAILED`: Verification check demonstrated the secret is still active or accessible in remote storage.
   - `NEEDS_MORE_WORK`: Partial containment confirmed, but additional credentials or affected systems require investigation.
2. **Technical Boundaries & Academic Viva Note:**
   - LeakLens performs defensive detection and authorized file inspection.
   - *Limitation:* LeakLens does **not** automatically contact external cloud providers (AWS, GitHub, Azure) to verify remote key invalidation. Verification is a structured human-in-the-loop workflow requiring explicit human validation notes.
