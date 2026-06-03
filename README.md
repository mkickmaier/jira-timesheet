# Jira PI Planning

A web application for Team Member Planning and Capacity Planning in Jira.

Features:
- **Team Member Planning**: Visualize and manage team member availability and absences across a PI.
- **PI Capacity Planning**: Visualize planned capacity vs. available capacity across iterations (sprints) for entire teams.
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

3. Install dependencies:
```
npm install
```

4. Start the server:
```
npm start
```
Visit http://localhost:3000

## Running with Docker

You can also run the application using Docker.

### Option 1: Docker Compose (Recommended)

1. Create a `.env` file with your Jira configuration (see [Setup](#setup)).
2. Run:
   ```bash
   docker-compose up -d
   ```
3. The application will be available at `http://localhost:3001`.

### Option 2: Docker Build

1. Build the image:
   ```bash
   docker build -t jira-pi-planning .
   ```
2. Run the container, passing environment variables:
   ```bash
   docker run -d -p 3001:3001 \
     -e JIRA_BASE_URL=https://your-domain.atlassian.net \
     -e JIRA_EMAIL=you@example.com \
     -e JIRA_PAT=your_pat_here \
     jira-pi-planning
   ```

## Endpoints
- GET /api/planning?pi=<PI_NAME>
- POST /api/planning
- GET /api/capacity?pi=<PI_NAME>
- GET /api/health

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

## PI Capacity Planning
The Capacity Planning page allows you to view the planned work (remaining estimates from Jira) against the available capacity for each team member.

### Iteration Naming
Iterations are expected to follow the pattern `<PI_NAME>_<NUMBER>`. For example, PI `26_04` would have iterations `26_04_01`, `26_04_02`, etc.

### Capacity Configuration
Available capacity is determined from the Planning data in the `example_files` directory. 
- Fallback: If no planning data is found or a member is missing, a default of 80 hours per iteration is used.

### Color Scheme
The capacity table uses colors to highlight resource allocation:
- **Red**: Over-planned by more than 5%.
- **Yellow**: Over-planned by 0% to 5%.
- **Normal**: Within capacity.
