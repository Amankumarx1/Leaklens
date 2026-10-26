# LeakLens — Local & Azure Development Setup Guide

**Platform:** LeakLens — Authorized Data Exposure Detection & Response  
**Current Phase:** Phase 1 Foundation & Database Architecture  

---

## 1. Prerequisites

Before running LeakLens locally, ensure the following software is installed on your workstation:

| Prerequisite | Minimum Version | Verification Command | Notes |
|---|---|---|---|
| **Node.js** | v20.x LTS or v24.x | `node -v` | Required runtime for backend and frontend tooling. |
| **npm** | v10.x or v11.x | `npm -v` | Package manager supporting npm workspaces. |
| **Git** | v2.40+ | `git --version` | Source control management. |
| **SQL Server** | 2022+ or Azure SQL | `sqlcmd -?` | Local SQL Server Express, Developer Edition, or Azure SQL DB. |

---

## 2. Environment Configuration

1. In the repository root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*

2. Configure the environment variables inside `.env`:
   ```ini
   NODE_ENV=development
   PORT=3000
   CLIENT_URL=http://localhost:5173

   # Database Configuration (Microsoft SQL Server / Azure SQL)
   DB_SERVER=localhost
   DB_PORT=1433
   DB_NAME=LeakLensDB
   DB_USER=leaklens_app
   DB_PASSWORD=YourStrongPasswordHere!
   DB_ENCRYPT=true
   DB_TRUST_SERVER_CERTIFICATE=true

   # Cryptographic Session Secret (Min 32 characters)
   SESSION_SECRET=dev-leaklens-secure-cryptographic-token-32chars-minimum
   ```

> [!WARNING]
> Never commit `.env` to version control. The repository's `.gitignore` explicitly excludes `.env` and all related files.

---

## 3. Database Initialization & Schema Deployment

### Option A: Local SQL Server via Docker
If you do not have SQL Server installed locally, spin up a container:
```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrongPasswordHere!" \
   -p 1433:1433 --name leaklens-mssql -d mcr.microsoft.com/mssql/server:2022-latest
```

### Option B: Least-Privilege Database User Creation
Log in as system administrator (`sa`) and execute:
```sql
CREATE DATABASE LeakLensDB;
GO

USE LeakLensDB;
GO

-- Create application login and least-privileged user
CREATE LOGIN leaklens_app WITH PASSWORD = 'YourStrongPasswordHere!';
CREATE USER leaklens_app FOR LOGIN leaklens_app;
ALTER ROLE db_datareader ADD MEMBER leaklens_app;
ALTER ROLE db_datawriter ADD MEMBER leaklens_app;
GRANT EXECUTE TO leaklens_app;
GO
```

### Option C: Execute DDL Scripts in Order
Execute the SQL files located in `database/` using `sqlcmd`, Azure Data Studio, or SQL Server Management Studio (SSMS):
1. **Tables, Constraints & Indexes:** `database/schema.sql`
2. **Analytical Views:** `database/views.sql`
3. **Stored Procedures:** `database/procedures.sql`
4. **Representative Query Verifications:** `database/queries.sql`

Example via `sqlcmd`:
```bash
sqlcmd -S localhost -d LeakLensDB -U leaklens_app -P "YourStrongPasswordHere!" -i database/schema.sql
sqlcmd -S localhost -d LeakLensDB -U leaklens_app -P "YourStrongPasswordHere!" -i database/views.sql
sqlcmd -S localhost -d LeakLensDB -U leaklens_app -P "YourStrongPasswordHere!" -i database/procedures.sql
```

> [!NOTE]
> If a live database server is temporarily unavailable during offline development, the backend automatically enters degraded mode, reporting database disconnect status while keeping the API and frontend fully accessible.

---

## 4. Installing Dependencies

Install dependencies across all workspaces from the project root:
```bash
npm install
```

---

## 5. Running the Application Locally

### Starting the Backend Server
From the repository root:
```bash
npm run dev:server
```
- Server API URL: `http://localhost:3000`
- Operational Health Check: `http://localhost:3000/api/health`

### Starting the React Frontend
In a separate terminal:
```bash
npm run dev:client
```
- Client Application: `http://localhost:5173`

---

## 6. Running Automated Tests & Linting

### Run Backend & Security Tests
```bash
npm test
```

### Run Frontend Static Analysis
```bash
npm run lint:client
```

### Verify Production Frontend Build
```bash
npm run build:client
```
