# Power BI Security Analytics & DP-900 Reporting Specification

## 1. Overview & Business Objectives

This document establishes the official **Power BI Security Analytics and DP-900 Data Services** reporting deliverable for **LeakLens — Authorized Data Exposure Detection & Response**.

LeakLens captures authorized file scans, pattern matches, in-memory redacted findings, incident lifecycles, and remediation actions in Microsoft Azure SQL Database. The Power BI reporting layer connects directly to relational views (`leaklens.vw_exposure_analytics`, `leaklens.vw_incident_analytics`, and `leaklens.vw_operational_metrics`), translating raw security telemetry into actionable executive scorecards, tactical triage visualizations, and DP-900 data quality summaries without exposing raw secrets.

---

## 2. Architecture & Connection Configuration

```
┌─────────────────────────────────┐
│     Azure SQL Database          │
│   Server: leaklens-sql.net      │
│   Database: LeakLensDB          │
│   Schema: leaklens              │
└───────────────┬─────────────────┘
                │
                │ DirectQuery / Scheduled Import (TLS Encrypted TDS)
                │ Least-Privilege Principal: 'powerbi_readonly'
                ▼
┌─────────────────────────────────┐
│     Power BI Data Model         │
│  - vw_exposure_analytics        │
│  - vw_incident_analytics        │
│  - vw_operational_metrics       │
│  - DimDate (Calendar Table)     │
└───────────────┬─────────────────┘
                │
                │ Interactive Semantic Model & DAX Calculations
                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Power BI Report Pages                           │
│  Page 1: Executive Overview   │  Page 2: Detection Analysis            │
│  Page 3: Incident Response    │  Page 4: Data Quality & Operations     │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Connection Parameters
- **Source Type:** Azure SQL Database.
- **Server:** `<sql-server-name>.database.windows.net` (e.g., `leaklens-sql-prod.database.windows.net`).
- **Database:** `LeakLensDB`.
- **Data Connectivity Mode:** **DirectQuery** (for near-real-time SOC alerting) or **Import Mode** with 4x daily scheduled refresh.
- **Authentication:** Microsoft Entra ID (Service Principal or Organizational Account) or dedicated read-only SQL principal (`powerbi_readonly`).
- **Data Classification:** Restricted / Aggregated Telemetry (Zero raw credentials; all findings display masked excerpts e.g., `ghp_***_890`).

---

## 3. Four-Page Report Design

### Page 1 — Executive Security Overview
Designed for CISOs, compliance officers, and IT risk committees to assess organization-wide exposure posture at a glance.

#### Visual Elements & Layout
1. **Top KPI Scorecards:**
   - **Total Scans Executed:** Cumulative scan jobs processed.
   - **Total Findings Detected:** Aggregate pattern matches across all files.
   - **High & Critical Exposures:** Urgent findings requiring immediate containment.
   - **Active Unresolved Incidents:** Incidents in `OPEN` or `IN_PROGRESS` status.
   - **Mean Time to Remediate (MTTR):** Average elapsed hours from detection to verified resolution.
2. **Temporal Detection Trend (Stacked Area Chart):**
   - *X-Axis:* Date (`DimDate[Date]`).
   - *Y-Axis:* Finding Count.
   - *Legend:* Secret Category (`API_KEY`, `DATABASE_CREDENTIAL`, `TOKEN`, `ASYMMETRIC_KEY`).
3. **Severity Distribution (Donut Chart):**
   - Critical (Red `#ef4444`), High (Orange `#f97316`), Medium (Yellow `#eab308`), Low (Blue `#06b6d4`).
4. **Incident Containment Pipeline (Horizontal Funnel):**
   - Open $\to$ In Progress $\to$ Pending Verification $\to$ Resolved $\to$ Closed.

---

### Page 2 — Detection Analysis & Rule Efficacy
Designed for detection engineers and security analysts evaluating signature effectiveness, false positives, and exposure patterns.

#### Visual Elements & Layout
1. **Detection Rule Leaderboard (Clustered Bar Chart):**
   - Matches by rule signature (e.g., `AWS_ACCESS_KEY`, `GITHUB_PAT`, `GENERIC_API_KEY`, `DB_CONNECTION_STRING`).
2. **Exposure by File Type & Extension (Matrix / Heatmap):**
   - Columns: MIME type (`text/plain`, `application/json`, `text/csv`).
   - Rows: Secret Category.
   - Values: Match Count.
3. **Escalation vs Suppression Rate (Scatter Plot):**
   - Evaluates whether specific rules produce actionable incidents or frequent false-positive suppressions.
4. **Interactive Slice Filters:**
   - Date Range Slider, Severity Checkboxes, Category Dropdown, File Search.

---

### Page 3 — Incident Response & Remediation Tracking
Designed for Security Operations Center (SOC) team leads tracking remediation velocity, analyst workloads, and SLA compliance.

#### Visual Elements & Layout
1. **Caseload by Lead Analyst (Stacked Column Chart):**
   - *X-Axis:* Analyst Display Name.
   - *Y-Axis:* Incident Count.
   - *Sub-division:* Status (`in_progress`, `pending_verification`, `resolved`).
2. **Unassigned Incidents Alert Table:**
   - High-priority incidents where `assigned_to IS NULL`, flagged with red alerts.
3. **Resolution Duration by Priority Tier (Box Plot / Bar Chart):**
   - Visualizes MTTR variance across Critical vs High vs Medium priority cases.
4. **Verification Outcomes Breakdown (Pie Chart):**
   - Independent verification check outcomes: `PASSED` vs `FAILED` vs `PENDING`.

---

### Page 4 — Data Quality & System Operations
Designed for DP-900 compliance, data engineers, and system administrators monitoring pipeline reliability and dataset integrity.

#### Visual Elements & Layout
1. **Scan Pipeline Success Ratio (Gauge Chart):**
   - Target: >99% completed scan rate. Current value: `[Scan Success Rate]`.
2. **Error Code Distribution (Table):**
   - Lists distinct error codes for failed scan jobs (e.g., `MALFORMED_JSON_SYNTAX`, `EMPTY_FILE`, `UNSUPPORTED_MIME_TYPE`).
3. **Total Data Scanned (Card):**
   - Megabytes / Gigabytes processed through private Azure Blob Storage.
4. **Relational Data Hygiene Check (Matrix):**
   - Verifies 0 orphan records across `files` $\to$ `scans`, `findings` $\to$ `rules`, and `incident_findings`.

---

## 4. Formal DAX (Data Analysis Expressions) Measures

```dax
// ==============================================================================
// 1. SCAN PIPELINE MEASURES
// ==============================================================================

Total Scans = 
COUNTROWS('vw_operational_metrics')

Completed Scans = 
CALCULATE(
    SUM('vw_operational_metrics'[total_jobs]),
    'vw_operational_metrics'[scan_status] = "completed"
)

Failed Scans = 
CALCULATE(
    SUM('vw_operational_metrics'[total_jobs]),
    'vw_operational_metrics'[scan_status] = "failed"
)

Scan Success Rate = 
DIVIDE([Completed Scans], SUM('vw_operational_metrics'[total_jobs]), 0)

// ==============================================================================
// 2. EXPOSURE & FINDING MEASURES
// ==============================================================================

Total Findings = 
SUM('vw_exposure_analytics'[total_findings])

Critical Exposures = 
CALCULATE(
    SUM('vw_exposure_analytics'[total_findings]),
    'vw_exposure_analytics'[severity] = "critical"
)

High Exposures = 
CALCULATE(
    SUM('vw_exposure_analytics'[total_findings]),
    'vw_exposure_analytics'[severity] = "high"
)

Critical & High Exposures = 
[Critical Exposures] + [High Exposures]

Escalation Rate = 
DIVIDE(
    SUM('vw_exposure_analytics'[findings_escalated_to_incidents]),
    [Total Findings],
    0
)

// ==============================================================================
// 3. INCIDENT RESPONSE & MTTR MEASURES
// ==============================================================================

Total Incidents = 
COUNTROWS('vw_incident_analytics')

Open Incidents = 
CALCULATE(
    COUNTROWS('vw_incident_analytics'),
    'vw_incident_analytics'[incident_status] IN {"open", "in_progress", "pending_verification"}
)

Resolved Incidents = 
CALCULATE(
    COUNTROWS('vw_incident_analytics'),
    'vw_incident_analytics'[incident_status] IN {"resolved", "closed"}
)

Unassigned Incidents = 
CALCULATE(
    COUNTROWS('vw_incident_analytics'),
    'vw_incident_analytics'[is_assigned] = 0
)

Mean Time to Remediate (Hours) = 
AVERAGEX(
    FILTER(
        'vw_incident_analytics',
        NOT(ISBLANK('vw_incident_analytics'[resolution_duration_hours]))
    ),
    'vw_incident_analytics'[resolution_duration_hours]
)

Incident Resolution Rate = 
DIVIDE([Resolved Incidents], [Total Incidents], 0)
```

---

## 5. Security & Data Governance Controls

1. **Zero Secret Disclosure:** Raw matching secrets are redacted in-memory during ingestion (`ghp_***_890`). Power BI reports never ingest or display unmasked secrets.
2. **Least-Privilege Database Access:** The Power BI service connects via a dedicated database user with `SELECT` permissions granted strictly on the `leaklens` reporting views:
   ```sql
   GRANT SELECT ON leaklens.vw_exposure_analytics TO powerbi_readonly;
   GRANT SELECT ON leaklens.vw_incident_analytics TO powerbi_readonly;
   GRANT SELECT ON leaklens.vw_operational_metrics TO powerbi_readonly;
   ```
3. **No Embedded Credentials:** Database connection strings and credentials must not be stored in published `.pbix` files or committed Git assets.
4. **Row-Level Security (RLS):** If tenant isolation is enabled, RLS filters `[assigned_to]` based on the user's Entra ID principal (`USERPRINCIPALNAME()`).
