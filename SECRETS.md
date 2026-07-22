# Using Podman Secrets for JIRA PAT

This guide explains how to use Podman secrets to securely store your JIRA Personal Access Token.

## Why Use Secrets?

Podman secrets provide a more secure way to handle sensitive data:
- ✅ Encrypted storage
- ✅ Not visible in container inspect or environment variables
- ✅ Can't accidentally leak in logs
- ✅ Proper secret rotation support

## Quick Start

The easiest way is to use the automated script:

```bash
./setup-secret.sh create
```

Then start your containers:

```bash
podman-compose up -d
```

## Manual Setup

### 1. Create the Secret

```bash
# Interactive (recommended - doesn't show the token on screen)
echo -n "your-jira-pat-token" | podman secret create jira_pat -

# Or from a file
podman secret create jira_pat /path/to/token.txt

# Or interactively
./setup-secret.sh create
```

### 2. Verify the Secret

```bash
podman secret ls
# or
./setup-secret.sh show
```

### 3. Start Containers

The `podman-compose.yml` is already configured to use the secret:

```bash
podman-compose up -d
```

The application will automatically read the PAT from `/run/secrets/jira_pat`.

## Managing Secrets

### Update the Secret

If you need to change your PAT:

```bash
./setup-secret.sh update
```

Then restart the containers:

```bash
podman-compose restart jira-pi-planning
```

### Delete the Secret

```bash
./setup-secret.sh delete
# or
podman secret rm jira_pat
```

### List All Secrets

```bash
podman secret ls
```

## How It Works

1. **Secret Creation**: The PAT is stored encrypted in Podman's secret storage
2. **Container Mount**: The secret is mounted as a read-only file at `/run/secrets/jira_pat`
3. **Application Read**: The Node.js app reads from the secret file at startup
4. **Fallback**: If no secret exists, it falls back to `JIRA_PAT` environment variable

## Environment Variable Fallback

If you prefer not to use secrets, you can still use environment variables:

1. Edit `podman-compose.yml` and uncomment:
   ```yaml
   - JIRA_PAT=${JIRA_PAT}
   ```

2. Comment out the secrets section:
   ```yaml
   # secrets:
   #   - jira_pat
   ```

3. Remove the external secret definition at the bottom:
   ```yaml
   # secrets:
   #   jira_pat:
   #     external: true
   ```

## Troubleshooting

**Secret not found error:**
```bash
Error: secret jira_pat not found
```
Solution: Create the secret first with `./setup-secret.sh create`

**Permission denied:**
```bash
Error: open /run/secrets/jira_pat: permission denied
```
Solution: Check that the container has proper permissions. The secret should be readable by the container user.

**App still uses environment variable:**
Check the application logs to see which source it's using:
```bash
podman-compose logs jira-pi-planning | grep SECRETS
```

You should see: `[SECRETS] Loaded jira_pat from secret file`

## Security Best Practices

1. **Never commit secrets to git**: The secret is stored in Podman, not in files
2. **Use secrets for production**: Environment variables are fine for dev, but use secrets in production
3. **Rotate secrets regularly**: Use `./setup-secret.sh update` to change your PAT periodically
4. **Minimal permissions**: Only give the secret to containers that need it
5. **Audit access**: Use `podman secret inspect jira_pat` to see when it was created/updated

## Comparison: Secrets vs Environment Variables

| Feature | Podman Secrets | Environment Variables |
|---------|---------------|----------------------|
| Security | ✅ Encrypted | ❌ Plain text |
| Visibility | ✅ Hidden | ❌ Visible in `inspect` |
| Rotation | ✅ Easy | ⚠️ Requires restart |
| Logs | ✅ Won't leak | ⚠️ Can leak |
| Setup | ⚠️ Extra step | ✅ Simple |

## Additional Secrets

You can add more secrets for other sensitive data:

```bash
# Create additional secrets
echo -n "smtp-password" | podman secret create smtp_password -

# Add to podman-compose.yml
secrets:
  - jira_pat
  - smtp_password

# Read in your app
const smtpPassword = readSecret('smtp_password');
```
