# DP-900: Azure Data Fundamentals — Viva Defense Guide

## 1. Core Data Classification in LeakLens

The **DP-900: Microsoft Azure Data Fundamentals** syllabus requires demonstrating an understanding of how data structures dictate storage service choices.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA CLASSIFICATION TAXONOMY                    │
├─────────────────────┬───────────────────┬──────────────────────────────┤
│ Classification      │ Data Type / Entity│ Storage Engine in LeakLens   │
├─────────────────────┼───────────────────┼──────────────────────────────┤
│ 1. STRUCTURED       │ • Users, Roles    │ Azure SQL Database           │
│                     │ • Scans, Files    │ (Relational Tables in 3NF    │
│                     │ • Findings        │ with strict schemas, PKs,    │
│                     │ • Incidents       │ FKs, and check constraints)  │
├─────────────────────┼───────────────────┼──────────────────────────────┤
│ 2. SEMI-STRUCTURED  │ • Audit Metadata  │ Hybrid: JSON in Azure SQL    │
│                     │ • Uploaded JSON   │ (`metadata_json` column) &   │
│                     │   Payloads        │ Azure Blob Storage           │
├─────────────────────┼───────────────────┼──────────────────────────────┤
│ 3. UNSTRUCTURED /   │ • Uploaded TXT    │ Azure Blob Storage           │
│    BINARY           │   Logs, Source    │ (Container: leaklens-scans,  │
│                     │ • Delimited CSV   │ Public Access: DISABLED)     │
└─────────────────────┴───────────────────┴──────────────────────────────┘
```

---

## 2. Relational vs. Non-Relational Storage Selection Rationale

### Why not store everything in Azure SQL Database?
- **Viva Defense Question:** *"Why didn't you just save the uploaded files as `VARBINARY(MAX)` in the `files` table?"*
- **Technical Answer:** Storing multi-megabyte binary files inside SQL Server creates **database buffer pool pollution**, dramatically inflates backup file sizes, increases I/O latency on clustered index seeks, and significantly raises Azure SQL storage costs. Storing files in **Azure Blob Storage** keeps the operational database lean, fast, and inexpensive (<$0.50/month for standard LRS).

### Why not store everything in a NoSQL document database (e.g., Azure Cosmos DB / MongoDB)?
- **Viva Defense Question:** *"Why did you use Azure SQL instead of Cosmos DB?"*
- **Technical Answer:** The incident containment workflow requires **multi-table atomic transactions**. When an incident is resolved, LeakLens must atomically update the incident record, update all associated findings in `leaklens.findings` to `remediated`, insert a remediation action record, and insert an immutable audit record. Relational ACID transactions and stored procedures (`sp_resolve_incident`) provide these guarantees out of the box. Cosmos DB requires partitioning strategies and JavaScript stored procedures scoped strictly to a single partition key, which is poorly suited for many-to-many security incident relationships.

---

## 3. Azure Blob Storage Security & Resilience Controls

1. **Anonymous Public Access Disabled:**
   - In Bicep: `allowBlobPublicAccess: false`.
   - On the container: `publicAccess: 'None'`.
   - Direct anonymous downloads via URL return HTTP 404/403. All data plane access requires authenticated backend proxying.
2. **Non-Reversible Storage Paths:**
   - User-provided filenames are never used as storage paths.
   - The application generates cryptographically opaque paths: `scans/{scan_id}/{file_id}.bin`.
   - Prevents directory traversal attacks and sensitive filename exposure in cloud logs.
3. **Dual-Phase Failure Recovery (Compensating Cleanup):**
   - Azure Blob Storage and Azure SQL do not share a two-phase commit transaction.
   - If a scan fails during parsing or relational insertion, `scannerService.js` executes a compensating cleanup call (`deleteBlob(blobPath)`), ensuring zero orphaned storage objects remain in Blob Storage.
4. **Lifecycle & Retention Policy:**
   - A 14-day soft-delete retention policy is configured in `main.bicep` to automatically clean up temporary scan artifacts.

---

## 4. Power BI DirectQuery vs. Import Mode

### DirectQuery Architecture:
- Power BI connects directly to `leaklens.vw_exposure_analytics` and `leaklens.vw_incident_analytics`.
- **Query Pushdown:** Every slicer filter and visual aggregation translates into an optimized T-SQL `GROUP BY` query executed on Azure SQL Database.
- **Benefits:** Near-real-time visibility for SOC analysts; zero data replication; compliance with data sovereignty regulations.
- **Performance Safeguard:** The reporting views use **Pre-Aggregated CTEs** so that joins between findings and incidents never produce cartesian duplicate rows.

### Key Calculated DAX Measures in the Model:
```dax
// Mean Time to Remediate (MTTR in Hours)
Mean Time to Remediate (Hours) = 
AVERAGEX(
    FILTER(
        'vw_incident_analytics',
        NOT(ISBLANK('vw_incident_analytics'[resolution_duration_hours]))
    ),
    'vw_incident_analytics'[resolution_duration_hours]
)

// Scan Pipeline Success Ratio
Scan Success Rate = 
DIVIDE(
    CALCULATE(SUM('vw_operational_metrics'[total_jobs]), 'vw_operational_metrics'[scan_status] = "completed"),
    SUM('vw_operational_metrics'[total_jobs]),
    0
)
```
