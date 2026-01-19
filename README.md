# Jira Time Tracking (Simple Timesheet)

A minimal web application to log time against your open Jira issues and manage worklogs. Supports Jira Cloud (REST API v3) and Jira Server/Data Center (REST API v2).

Features:
- Lists your open Jira issues (assigned to you, not done)
- Add worklog entries (date, start time, duration)
- Weekly view: view, edit, and delete worklogs grouped by day (Mon–Sun) across your open issues; navigate weeks
- PI Capacity Planning: visualize planned capacity vs. available capacity across iterations (sprints) for entire teams.
- Excel Integration: parse team member capacity from uploaded Excel files.
- Server-only credentials via .env; browser talks only to the local server

## Prerequisites
- Node.js 18+
- Jira account
- For Jira Cloud: API token (create at https://id.atlassian.com/manage-profile/security/api-tokens)
- For Jira Server/DC: Personal Access Token (PAT) created in Jira (version 8.14+)

## Setup
1. Clone this repo.
2. Copy .env.example to .env and fill values.

For Jira Cloud:
```
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=atlassian_api_token
# optional overrides
# JIRA_API_VERSION=3
# JIRA_AUTH_TYPE=basic
PORT=3000
```

For Jira Server/Data Center:
```
JIRA_BASE_URL=https://jira.your-company.com
# Use a Personal Access Token (PAT) created in Jira (DC 8.14+)
JIRA_PAT=your_pat_here
# optional overrides
# JIRA_API_VERSION=2
# JIRA_AUTH_TYPE=bearer
PORT=3000
```
Optional: JIRA_ACCOUNT_ID if you need explicit author on worklogs.

3. Install dependencies:
```
npm install
```

4. Start the server:
```
npm start
```
Visit http://localhost:3000

## Endpoints
- GET /api/issues (accepts optional ?jql=... to override the default JQL)
- GET /api/issues/:issueId/worklogs
- POST /api/issues/:issueId/worklogs
- PUT /api/issues/:issueId/worklogs/:worklogId
- DELETE /api/issues/:issueId/worklogs/:worklogId
- GET /api/health
- GET /api/capacity?pi=<PI_NAME> (e.g. 26_04)
- POST /api/capacity/upload (multipart/form-data with 'pi' and 'file' fields)

Notes:
- The frontend shows a weekly timesheet (Mon–Sun), aggregating worklogs across your open issues. You can navigate weeks and edit/delete entries inline. New entries are added for the selected issue.
- Auth auto-detection: if your JIRA_BASE_URL ends with .atlassian.net, the server defaults to Cloud (API v3 + Basic with email:API token). Otherwise it defaults to Server/DC (API v2). For Server/DC, it defaults to Bearer if JIRA_PAT is provided; otherwise Basic. You can override via JIRA_API_VERSION and JIRA_AUTH_TYPE.

## Security
- The server uses either Basic auth (email + API token) for Cloud or Bearer (Personal Access Token) for Server/DC; keep your .env safe.
- Do not deploy without securing the server (auth, CORS, rate limits) if exposed beyond localhost.

## Corporate TLS (Trust CA in code)
If your Jira uses certificates signed by a private corporate CA or an SSL inspection proxy, the server now supports trusting extra CAs from code without disabling TLS verification.

Two options:

1) Provide a directory with CA files
- Export your corporate Root and intermediate CA certificates in Base-64 (.cer/.crt/.pem).
- Place them in a folder (e.g., `C:\\Certs\\CorpCAs`).
- In `.env`, set:
```
EXTRA_CA_DIR=C:\\Certs\\CorpCAs
```
- Restart the server.

2) Provide a single bundle file
- Concatenate your CA chain into one file and set the standard Node variable (can be in `.env` or your shell):
```
NODE_EXTRA_CA_CERTS=C:\\Certs\\corp-root.cer
```

Notes:
- TLS verification remains enabled (rejectUnauthorized=true).
- The server also normalizes `JIRA_BASE_URL` to remove a trailing slash to avoid double `//` in requests.

## PI Capacity Planning
The Capacity Planning page allows you to view the planned work (remaining estimates from Jira) against the available capacity for each team member.

### Iteration Naming
Iterations are expected to follow the pattern `<PI_NAME>_<NUMBER>`. For example, PI `26_04` would have iterations `26_04_01`, `26_04_02`, etc.

### Capacity Excel Configuration
Available capacity is parsed from Excel files stored in the `example_files` directory. 
- Filename pattern: `PI_CAPA_20<PI_NAME>.xlsx` (e.g., `PI_CAPA_2026_04.xlsx` for PI `26_04`).
- The Excel should have:
  - Row 1: Member names starting from Column E (index 4).
  - Column A: Iteration names (e.g., `PI2026_04_01`).
  - Column B: Row type. Rows with `CAPA` are used to extract available hours.
- Fallback: If no Excel file is found or a member is missing, a default of 80 hours per iteration is used.

### Color Scheme
The capacity table uses colors to highlight resource allocation:
- **Red**: Over-planned by more than 5%.
- **Yellow**: Over-planned by 0% to 5%.
- **Normal**: Within capacity.

### Uploading Capacity
You can upload the Excel file directly through the Capacity Planning interface. Enter the PI name, choose your `.xlsx` file, and click "Upload". The server will automatically rename and store it in the correct location.
