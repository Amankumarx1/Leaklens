# DP-900 Data Services & Data Classification Specification

## 1. Executive Summary

This document fulfills the **DP-900: Microsoft Azure Data Fundamentals** academic requirement for **LeakLens — Authorized Data Exposure Detection & Response**.

A fundamental concept in cloud data architecture is selecting the appropriate data store based on data structure, schema velocity, query patterns, and cost efficiency. LeakLens implements a hybrid cloud architecture combining **relational data services (Azure SQL Database)** for operational ACID transactions and **non-relational object storage (Azure Blob Storage)** for arbitrary file payload persistence.

---

## 2. Core Data Classification Matrix

| Data Entity / Category | Structural Classification | Storage Service & Engine | Schema Governance | Justification & Access Patterns |
| :--- | :--- | :--- | :--- | :--- |
| **Users & Authentication** | **Structured** | Azure SQL Database (`leaklens.users`) | Strict 3NF Relational Schema | Requires strict ACID transactions, uniqueness constraints on emails, and sub-millisecond index seeks during login. |
| **Scan Job Lifecycles** | **Structured** | Azure SQL Database (`leaklens.scan_jobs`) | Strict 3NF Relational Schema | State machine transitions (`in_progress` $\to$ `completed` / `failed`) require foreign key integrity to user identities. |
| **File Metadata & Hashes** | **Structured** | Azure SQL Database (`leaklens.files`) | Strict 3NF Relational Schema | Stores cryptographic SHA-256 digests, byte sizes, and blob references for rapid deduplication searches. |
| **Detection Rules** | **Structured** | Azure SQL Database (`leaklens.detection_rules`) | Strict 3NF Relational Schema | Centralized pattern signatures and severity levels; queried by scan workers on startup. |
| **Exposure Findings** | **Structured** | Azure SQL Database (`leaklens.findings`) | Strict 3NF Relational Schema | Findings require complex multi-dimensional indexing (by severity, status, category) for triage and aggregation views. |
| **Incidents & Associations** | **Structured** | Azure SQL Database (`leaklens.incidents`, `incident_findings`) | Strict 3NF Relational Schema | Encapsulates incident response workflows and atomic stored procedure updates (`sp_resolve_incident`). |
| **Audit Trails & Evidence** | **Semi-Structured** | Azure SQL Database (`leaklens.audit_logs`) | Hybrid: Relational Envelope + JSON Column (`metadata_json`) | Envelope stores fixed attributes (user_id, event_type, created_at) while `metadata_json` provides schema flexibility for disparate event payloads. |
| **Uploaded Text Files (.txt)** | **Unstructured** | Azure Blob Storage (Private Container: `leaklens-scans`) | Schema-less Binary Stream | Raw arbitrary text sequences; relational databases are poorly suited for multi-megabyte unstructured string storage. |
| **Uploaded JSON Files (.json)** | **Semi-Structured** | Azure Blob Storage (Private Container: `leaklens-scans`) | Key-Value / Nested Hierarchical Document | Retains hierarchical structure for recursive parser traversal without requiring database column alterations. |
| **Uploaded Tabular Files (.csv)**| **Structured / Tabular Payload** | Azure Blob Storage (Private Container: `leaklens-scans`) | Delimited Row/Column Format | Even though tabular in nature, storing large submitted files as raw blobs keeps the operational database lean and performant. |
| **Aggregated Metrics** | **Structured** | Azure SQL Views (`vw_exposure_analytics`, `vw_incident_analytics`) & Power BI | Relational Materialized / Calculated Views | Enables DirectQuery ingestion and performant BI dashboard filtering without joins over raw transaction tables. |
| **Documentation & Models** | **Unstructured Documents** | Git Repository / Markdown / Mermaid | Plaintext Document Markup | Architecture specifications, manuals, and diagrams maintained in version control. |

---

## 3. Azure Data Services Evaluation & Selection Rationale

### 3.1 Relational Service: Azure SQL Database (General Purpose / Basic Tier)
- **Why Chosen:** 
  - Guarantees strict ACID properties required for financial-grade incident management and non-repudiation.
  - Native support for complex relational joins, foreign keys, constraints, and stored procedures (`sp_resolve_incident`).
  - Native integration with Microsoft Entra Managed Identity for passwordless authentication.
  - Low-cost academic tier (Basic 5 DTU, 2GB cap at ~$4.99/mo or student credits).
- **Alternative Considered & Rejected:** 
  - *Azure Cosmos DB (MongoDB/SQL API):* Rejected because incident resolution requires multi-document transactional updates across findings, actions, and audit logs that are more naturally modeled in a 3NF relational schema.

### 3.2 Non-Relational Service: Azure Blob Storage (Standard LRS)
- **Why Chosen:**
  - Highly scalable, cost-effective object storage (<$0.50/mo for <5GB).
  - Native support for arbitrary binary data with strong encryption at rest (256-bit AES).
  - Strict security controls: anonymous public access completely disabled (`allowBlobPublicAccess: false`), fine-grained container RBAC (`Storage Blob Data Contributor`).
  - Enables non-reversible path generation (`scans/{scan_id}/{file_id}.bin`) to prevent directory traversal and sensitive filename leakage.
- **Alternative Considered & Rejected:**
  - *Storing files as `VARBINARY(MAX)` in SQL Server:* Rejected because large binary payloads cause database buffer pool bloat, dramatically degrade indexing performance, and increase backup overhead.

---

## 4. End-to-End Data Pipeline & Transformation Lifecycle

```
[ Uploaded File (.txt, .json, .csv) ]
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Ingestion: Memory Buffer (Multer)                      │
│ - Validate Size, MIME, Non-empty                       │
│ - Calculate SHA-256 Hash Digest                        │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ├──> [ Azure Blob Storage (Raw File Encrypted) ]
                  │     Path: scans/{scanId}/{fileId}.bin
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Worker Parser & Detection Engine                       │
│ - Structural Parsing (CSV rows, JSON trees, Text lines)│
│ - Regex Rule Evaluation                                │
│ - In-Memory Redaction: maskSecret(ghp_***_890)         │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Persistence: Azure SQL Database                        │
│ - INSERT files (metadata & blob_path only)             │
│ - INSERT findings (masked_excerpt only)                │
│ - INSERT audit_logs (metadata_json payload)            │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Reporting: Power BI DirectQuery                        │
│ - vw_exposure_analytics (Pre-aggregated CTEs)          │
│ - vw_incident_analytics (MTTR Calculations)            │
│ - vw_operational_metrics (Pipeline Health)             │
└────────────────────────────────────────────────────────┘
```

---

## 5. DP-900 Data Governance & Security Controls

1. **Defense-in-Depth Storage Isolation:**
   - Raw files reside in private Blob Storage accessible only by the backend's Managed Identity.
   - The relational database holds only metadata, hashes, and masked snippets.
2. **Dual-Phase Failure Recovery:**
   - In the event of a downstream SQL failure or parsing error, a compensating deletion (`deleteBlob`) is immediately executed to ensure no orphaned storage objects linger in Blob Storage.
3. **Data Retention & Lifecycle:**
   - A 14-day blob retention policy ensures temporary authorized test files are automatically purged after the audit cycle.
