# Network Isolation and Security

This document explains the network architecture and security isolation in the setup.

## Architecture

```
┌─────────────────────────────────────────────┐
│           Host / Internet                    │
│                                              │
│  HTTPS (443) ──┐                             │
│  HTTP  (80) ───┤                             │
└────────────────┼────────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │  Nginx Proxy  │ ← Only this is exposed to host
         │  (port 443)   │
         └───────┬───────┘
                 │
         Internal Network
         (internal: true)
         (isolated)
                 │
                 ▼
    ┌────────────────────────┐
    │  JIRA PI Planning App  │ ← NOT accessible from host
    │     (port 3001)        │
    └────────┬───────────────┘
             │
     External Network
     (normal bridge)
     (has internet)
             │
             ▼
    ┌─────────────────┐
    │   JIRA API      │
    │ (your company)  │
    └─────────────────┘
```

## Network Configuration

### Dual Network Setup

The application uses TWO separate networks:

#### 1. Internal Network (`internal: true`)

**Purpose:** Proxy ↔ App communication

✅ **Containers can communicate with each other**
- nginx-proxy can reach jira-pi-planning on port 3001
- Using container names as hostnames (e.g., `http://jira-pi-planning:3001`)

❌ **Containers CANNOT reach the host network or internet**
- No internet access through this network
- No direct access from host to app container IP

❌ **Host CANNOT reach containers directly**
- You cannot `curl http://container-ip:3001` from your host machine

**Connected services:**
- `jira-pi-planning` (app)
- `proxy` (nginx)

#### 2. External Network (normal bridge)

**Purpose:** App → JIRA API communication

✅ **Has internet access**
- App can make API calls to JIRA
- App can reach external services

❌ **No host port access (no ports exposed)**
- Even though this network has internet access
- Without port exposure, still cannot be reached from host

**Connected services:**
- `jira-pi-planning` (app only)
- NOT the proxy (proxy doesn't need internet)

### Why This Dual-Network Design?

**Security Requirements:**
1. ✅ App must reach JIRA API (needs internet)
2. ✅ App must NOT be directly accessible from host (needs isolation)
3. ✅ Proxy must reach app (needs shared network)
4. ✅ Proxy doesn't need internet (nginx serves and proxies only)

**Solution:**
- **Internal network** = Isolated communication channel (proxy ↔ app)
- **External network** = Internet access for API calls (app ↔ JIRA)
- **App** = On BOTH networks (can proxy AND call APIs)
- **Proxy** = Only on internal (isolated, no internet needed)

### Security Validation

**Without proper isolation** (just using `bridge`, or exposing ports)::
```bash
# BAD: App is directly accessible, bypassing auth & TLS
curl http://localhost:3001  # This would work!
curl http://container-ip:3001  # This would work too!
```

**With dual-network setup** (internal + external):
```bash
# GOOD: Only proxy is accessible
curl https://localhost  # Works, goes through proxy (with auth & TLS)
curl http://localhost:3001  # Fails! Port not exposed
curl http://container-ip:3001  # Fails! Internal network isolated
```

## Testing Network Isolation

Use the provided test script:

```bash
./test-isolation.sh
```

This will verify:
1. ✅ Proxy is accessible from host
2. ✅ Proxy can reach app internally
3. ✅ App is NOT accessible directly from host

## When App Needs Internet Access

This configuration **already provides internet access** to the app via the `external` network!

The app can:
✅ Make API calls to JIRA
✅ Download npm packages (during build)
✅ Reach any external service

But still:
❌ Cannot be reached from host directly
❌ No ports exposed
❌ Only accessible through the proxy

### If You Don't Need Internet Access

If your app doesn't need to reach external services (rare case), you can simplify to a single network:

```yaml
services:
  jira-pi-planning:
    networks:
      - internal  # Remove external network
  
  proxy:
    networks:
      - internal

networks:
  internal:
    driver: bridge
    internal: true
  
  # Remove external network entirely
```

## Checking Your Setup

### View network configuration:
```bash
podman network ls
podman network inspect <network-name>
```

### Check if network is internal:
```bash
podman network inspect <network-name> --format '{{.Internal}}'
# Should output: true
```

### Check what networks containers are on:
```bash
podman inspect jira-pi-planning --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# Should output: internal external

podman inspect nginx-proxy --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# Should output: internal
```

### Check what ports are actually exposed:
```bash
podman ps
# Look for PORT column - jira-pi-planning should have none
# Only nginx-proxy should have 0.0.0.0:443->443 and 0.0.0.0:80->80
```

## Troubleshooting

### App is still accessible from host

**Symptom:**
```bash
curl http://localhost:3001  # This works when it shouldn't
```

**Solutions:**

1. Check for exposed ports in compose file:
   ```bash
   grep -A5 "jira-pi-planning:" podman-compose.yml | grep ports
   # Should return nothing
   ```

2. Make sure you stopped old containers:
   ```bash
   podman-compose down
   podman-compose up -d
   ```

3. Check if port was published on host:
   ```bash
   podman port jira-pi-planning
   # Should return nothing or "Error: No public ports..."
   ```

4. Verify network is internal:
   ```bash
   podman network inspect $(podman inspect jira-pi-planning --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}') --format '{{.Internal}}'
   # Should output: true
   ```

### Proxy can't reach app

**Symptom:**
```bash
podman logs nginx-proxy
# Shows: connect() failed (111: Connection refused) while connecting to upstream
```

**Solutions:**

1. Make sure both containers are on the same network:
   ```bash
   podman inspect jira-pi-planning --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
   podman inspect nginx-proxy --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
   # Should both show: internal
   ```

2. Check app is listening:
   ```bash
   podman logs jira-pi-planning
   # Should show: Server is running on http://0.0.0.0:3001
   ```

3. Test from inside proxy container:
   ```bash
   podman exec nginx-proxy wget -O- http://jira-pi-planning:3001/api/health
   ```

### App can't reach JIRA API

**Symptom:**
```bash
podman logs jira-pi-planning
# Shows: ENOTFOUND, connection timeout, or similar errors when calling JIRA
```

**Solution:** The app needs internet access. See "When App Needs Internet Access" above.

For this app specifically: Check if API calls are made server-side or client-side.
- If client-side (browser makes API calls): No change needed
- If server-side: Add an external network for the app

## Security Best Practices

1. ✅ **Use internal networks** for backend services
2. ✅ **Only expose proxy ports** to the host
3. ✅ **Never expose app ports** directly
4. ✅ **Use secrets** for sensitive data (not environment variables)
5. ✅ **Keep proxy and app on same internal network**
6. ✅ **Test isolation** regularly with `./test-isolation.sh`
7. ✅ **Monitor logs** for unexpected connection attempts
8. ⚠️ **Consider host firewall** rules as additional protection

## Additional Hardening

For production:

```yaml
services:
  jira-pi-planning:
    # ... other config ...
    security_opt:
      - no-new-privileges:true
    read_only: true  # If your app supports it
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if needed
```
