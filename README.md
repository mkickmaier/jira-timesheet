# Jira PI Planning

A web application for Team Member Planning and Capacity Planning in Jira.

Features:
- **Team Member Planning**: Visualize and manage team member availability and absences across a PI.
- **PI Capacity Planning**: Visualize planned capacity vs. available capacity across iterations (sprints) for entire teams.
- Server-only credentials via .env; browser talks only to the local server
- **Secure Deployment**: Nginx reverse proxy with TLS and HTTP Basic Authentication

## Prerequisites
- Node.js 18+ (for local development)
- Podman and podman-compose (for containerized deployment)
- Jira account
- For Jira Cloud: API token (create at https://id.atlassian.com/manage-profile/security/api-tokens)
- For Jira Server/DC: Personal Access Token (PAT) created in Jira (version 8.14+)

## Quick Start with Podman (Recommended)

The easiest way to run the application with TLS and authentication:

```bash
./setup.sh
```

This will:
1. Generate SSL certificates (self-signed for development)
2. Create HTTP Basic Auth credentials
3. Build and start both the app and nginx proxy
4. Make the app available at https://localhost

**Access the application:**
- URL: https://localhost
- Enter the username/password you created during setup
- Your browser will warn about self-signed certificates (this is normal for development)

## Manual Setup

### 1. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

**For Jira Cloud:**
```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@example.com
# JIRA_PAT is recommended to be stored as a Podman secret (see below)
# Or set it here: JIRA_PAT=your_api_token_here
JIRA_AUTH_TYPE=basic
PORT=3001
```

**For Jira Server/Data Center:**
```env
JIRA_BASE_URL=https://jira.your-company.com
# JIRA_PAT is recommended to be stored as a Podman secret (see below)
# Or set it here: JIRA_PAT=your_pat_here
JIRA_AUTH_TYPE=bearer
PORT=3001
```

### 2a. Store JIRA PAT as a Secret (Recommended)

For better security, store your JIRA PAT as a Podman secret:

```bash
./setup-secret.sh create
```

This keeps your PAT encrypted and separate from configuration files. See [SECRETS.md](SECRETS.md) for detailed documentation.

### 2. Generate SSL Certificates

**For Development (self-signed):**
```bash
./setup-certs.sh
```

**For Production:**
Place your real certificates in `nginx/certs/`:
```bash
# Example with Let's Encrypt
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/certs/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/certs/key.pem
chmod 600 nginx/certs/key.pem
```

### 3. Create HTTP Basic Auth

```bash
./setup-auth.sh
```

Or manually:
```bash
htpasswd -c nginx/.htpasswd username
```

### 4. Start the Application

```bash
podman-compose build
podman-compose up -d
```

## Alternative: Local Development (No Proxy)

For local development without the proxy:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Visit http://localhost:3001

## Container Management

**View logs:**
```bash
podman-compose logs -f              # All services
podman-compose logs -f jira-pi-planning  # App only
podman-compose logs -f proxy        # Proxy only
```

**Stop services:**
```bash
podman-compose down
```

**Restart services:**
```bash
podman-compose restart
```

**Rebuild after code changes:**
```bash
podman-compose build
podman-compose up -d
```

**Test network isolation:**
```bash
./test-isolation.sh
```
This verifies that the app is only accessible through the proxy, not directly.

## Architecture

When running with podman-compose:

```
Internet/Browser         Internet (JIRA API)
    ↓                          ↑
    ↓                          ↑
    ↓ HTTPS (443)              ↑
    ↓                          ↑
Nginx Proxy              External Network
(exposed)                (bridge)
    │                          │
    ├─ TLS termination         │
    ├─ HTTP Basic Auth         │
    └─ Reverse proxy           │
        │                        │
        ↓ Internal Network       │
        ↓ (isolated)             │
        ↓                        │
        └───────┬─────────────┘
                │
          JIRA PI Planning App
          (NOT exposed)
          port 3001
```

**Dual Network Isolation:**
- **Internal network** (isolated): Proxy ↔ App communication
  - App is NOT accessible from host/internet
  - Prevents bypassing auth and TLS
- **External network** (bridge): App → JIRA API calls
  - App can reach JIRA and external services
  - No ports exposed, so still not accessible from outside
- **Proxy**: Only on internal network (doesn't need internet)
- **App**: On BOTH networks (can proxy AND call APIs)

**Security layers:**
1. **Network Isolation**: App not directly reachable from host
2. **TLS/HTTPS**: Encrypted communication
3. **HTTP Basic Auth**: Username/password protection
4. **No exposed ports**: Only proxy ports 80/443 are accessible

## File Structure

```
.
├── podman-compose.yml          # Container orchestration
├── Dockerfile                  # App container definition
├── setup.sh                    # Quick setup script
├── setup-auth.sh              # Create auth credentials
├── setup-certs.sh             # Generate SSL certificates
├── setup-secret.sh            # Manage Podman secrets
├── test-isolation.sh          # Test network isolation
├── .env                       # Environment config (create from .env.example)
├── SECRETS.md                 # Podman secrets documentation
├── NETWORK-ISOLATION.md       # Network security documentation
├── nginx/                     # Reverse proxy configuration
│   ├── nginx.conf            # Main nginx config
│   ├── conf.d/
│   │   └── app.conf         # Application proxy settings
│   ├── .htpasswd            # Basic auth credentials (generated)
│   └── certs/               # SSL certificates (generated)
│       ├── cert.pem
│       └── key.pem
├── server/                    # Application server code
├── web/                       # Static web assets
└── uploads/                   # Upload directory (created at runtime)
```

## API Endpoints

- GET /api/planning?pi=<PI_NAME>
- POST /api/planning
- GET /api/capacity?pi=<PI_NAME>
- GET /api/health

## Features

### PI Capacity Planning

The Capacity Planning page allows you to view the planned work (remaining estimates from Jira) against the available capacity for each team member.

**Iteration Naming:**
Iterations are expected to follow the pattern `<PI_NAME>_<NUMBER>`. For example, PI `26_04` would have iterations `26_04_01`, `26_04_02`, etc.

**Capacity Configuration:**
Available capacity is determined from the Planning data in the `example_files` directory. 
- Fallback: If no planning data is found or a member is missing, a default of 80 hours per iteration is used.

**Color Scheme:**
The capacity table uses colors to highlight resource allocation:
- **Red**: Over-planned by more than 5%.
- **Yellow**: Over-planned by 0% to 5%.
- **Normal**: Within capacity.

## Corporate TLS (Trust CA in code)

If your Jira uses certificates signed by a private corporate CA or an SSL inspection proxy, the server supports trusting extra CAs without disabling TLS verification.

**Option 1: Provide a directory with CA files**
- Export your corporate Root and intermediate CA certificates in Base-64 (.cer/.crt/.pem).
- Place them in a folder (e.g., `./Frequentis-Certificates`).
- In `.env`, set:
  ```env
  EXTRA_CA_DIR=./Frequentis-Certificates
  ```

**Option 2: Provide a single bundle file**
- Concatenate your CA chain into one file and set:
  ```env
  NODE_EXTRA_CA_CERTS=./certs/corp-root.cer
  ```

## Production Deployment

For production deployment:

1. **Use real SSL certificates** (Let's Encrypt, commercial CA)
2. **Change default passwords** in `.htpasswd`
3. **Update server_name** in `nginx/conf.d/app.conf` to your domain
4. **Secure your `.env` file** (never commit to git)
5. **Consider additional security:**
   - Rate limiting
   - IP whitelisting
   - Fail2ban
   - Regular security updates

## Security

- The server uses either Basic auth (email + API token) for Cloud or Bearer (Personal Access Token) for Server/DC
- Keep your `.env` file secure and never commit it to version control
- The nginx proxy adds an additional authentication layer
- All traffic is encrypted with TLS when using the proxy setup

## Troubleshooting

**Certificate warnings:**
- Self-signed certificates will show browser warnings
- For production, use proper certificates from Let's Encrypt or a commercial CA

**Can't connect:**
- Check containers are running: `podman-compose ps`
- View logs: `podman-compose logs`
- Ensure ports 80 and 443 are not in use by other services

**Authentication not working:**
- Verify `.htpasswd` file exists: `ls -l nginx/.htpasswd`
- Check nginx logs: `podman-compose logs proxy`

**App not accessible via proxy:**
- Verify both containers are on the same network
- Check nginx logs for proxy errors
- Ensure the app is listening on port 3001
