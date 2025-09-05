# Jira Time Tracking (Simple Timesheet)

A minimal web application to log time against your open Jira issues and manage worklogs. Supports Jira Cloud (REST API v3) and Jira Server/Data Center (REST API v2).

Features:
- Lists your open Jira issues (assigned to you, not done)
- Add worklog entries (date, start time, duration)
- Weekly view: view, edit, and delete worklogs grouped by day (Mon–Sun) across your open issues; navigate weeks
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
