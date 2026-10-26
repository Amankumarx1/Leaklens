# LeakLens — Scanner & Detection Engine Design Specification

**Platform:** LeakLens — Authorized Data Exposure Detection & Response  
**Service:** `server/src/services/scanner/`  
**Standard:** Defensive Secret Redaction, Locational Precision & 3NF Persistence  

---

## 1. Engine Purpose & Scope

The LeakLens Scanning Engine is an independent defensive service designed to inspect authorized files for accidental sensitive-data patterns (such as credentials, private keys, API tokens, and personally identifiable information). 

> [!IMPORTANT]
> **Pattern Match vs. Confirmed Data Breach:**  
> The scanner identifies potential exposure risk based on deterministic structural signatures and high-entropy formatting. Detecting a pattern does **not** prove that a secret is active, exfiltrated, or exploitable. LeakLens does **not** ping third-party identity providers to test credential validity.

---

## 2. Supported Parsers & Locational Precision

Files are processed in-memory using dedicated, isolated parsers before regex evaluation:

| Format | Extension | Parser Module | Locational Coordinate Reference |
|---|---|---|---|
| **Plain Text** | `.txt` | `parsers/textParser.js` | 1-indexed line references (e.g. `line:42`). |
| **JSON Structures** | `.json` | `parsers/jsonParser.js` | Key-path references (e.g. `$.services.stripe.apiKey`) and line numbers. Syntax errors raise `MALFORMED_JSON`. |
| **Spreadsheet Exports**| `.csv` | `parsers/csvParser.js` | Row and column header coordinates (e.g. `row:15,col:customer_email`). |

### Safety Boundaries:
- **Maximum File Size:** Configured to 5 MB (`MAX_FILE_SIZE = 5 * 1024 * 1024`).
- **Binary Rejection:** First 8 KB are scanned for null bytes (`0x00`). If detected, the file is rejected with `BINARY_NOT_SUPPORTED` (HTTP 415).
- **Extension Allowlist:** Only `.txt`, `.json`, and `.csv` are processed. Unsupported formats (e.g. `.exe`, `.pdf`, `.zip`) are rejected with `UNSUPPORTED_FORMAT` (HTTP 415).
- **Zero Local Execution:** Uploaded files are strictly parsed as passive text data; scripts or macros are never evaluated or executed.

---

## 3. Canonical Detection Rules

Rules are loaded dynamically from the `leaklens.detection_rules` table (or fallback canonical registry):

| Rule Name | Category | Severity | Pattern Strategy | Limitations & False-Positive Note |
|---|---|---|---|---|
| `EMAIL_ADDRESS_RULE` | `EMAIL_ADDRESS` | `LOW` | RFC 5322 bounded email pattern matching `@` and valid TLDs. | May match public contact emails or documentation samples. Severity is rated LOW. |
| `API_KEY_CANDIDATE_RULE`| `API_KEY_CANDIDATE` | `HIGH` | Matches known credential prefixes (`key_live_`, `sk_test_`, `ghp_`, `gho_`) with entropy body. | Captures demonstration keys and structured API tokens. Does not prove token is usable. |
| `PRIVATE_KEY_MARKER_RULE`| `PRIVATE_KEY_MARKER`| `CRITICAL`| Matches standard PEM header markers (`-----BEGIN PRIVATE KEY-----`). | Detects header marker only. **The private key body is never stored in persistent finding records.** |
| `SENSITIVE_IDENTIFIER_RULE`| `SENSITIVE_IDENTIFIER`| `MEDIUM` | Matches internal corporate token signatures (`LL-ID-[A-Z0-9]{4}-[A-Z0-9]{4}`). | Structured identifier format. Excludes generic numeric sequences. |

---

## 4. Sensitive-Data Masking Strategy

LeakLens implements a **zero raw secret persistence policy**. The dedicated masking service (`services/scanner/maskingService.js`) sanitizes matched secrets in memory before they are saved to the relational database, displayed on the UI, or written to logs.

| Category | Raw Example | Masked Excerpt Output | Retention Guarantee |
|---|---|---|---|
| `EMAIL_ADDRESS` | `analyst.jane@corp.internal` | `a***e@corp.internal` | Local part redacted; domain retained for verification. |
| `API_KEY_CANDIDATE` | `key_live_948fbc28a01f7c5e1903` | `key_live_***_1903` | Entropy body scrubbed; prefix and suffix retained for rotation. |
| `PRIVATE_KEY_MARKER` | Full RSA/EC Private Key PEM block | `[MASKED PRIVATE KEY BLOCK]` | Entire key block replaced with static marker. Zero raw bytes stored. |
| `SENSITIVE_IDENTIFIER` | `LL-ID-A9F2-4801` | `LL-ID-***-4801` | Token sequence masked. |

---

## 5. Scan Lifecycle & Orchestration

The scan lifecycle transitions through documented states:

```
[Upload Received]
       │
       ▼
  (Validate File Size & Extension)
       │
       ▼
 [Scan Job Created: in_progress] ──► [Audit Log: scan_created]
       │
       ▼
  (Parse File & Compute SHA-256)
       │
       ▼
  (Evaluate Enabled Detection Rules)
       │
       ▼
  (Apply In-Memory Redaction / Masking)
       │
       ▼
  (Persist Files & Findings Batch in 3NF Schema)
       │
       ├──► [Success] ──► [Scan Job: completed] ──► [Audit Log: scan_completed]
       │
       └──► [Failure] ──► [Scan Job: failed]    ──► [Audit Log: scan_failed]
```

### Error Handling & Temporary Storage:
- Buffers are held in-memory via `multer.memoryStorage()`.
- Temporary copies or parsed items are cleaned up immediately upon request completion.
- Failures during parsing or detection update the scan job status to `failed` and record safe, non-secret error codes in `error_code`.
