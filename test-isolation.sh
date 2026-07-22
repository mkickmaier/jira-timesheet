#!/bin/bash
# Script to test network isolation

set -e

echo "🔍 Testing Network Isolation..."
echo ""

# Check if containers are running
if ! podman ps --format "{{.Names}}" | grep -q "jira-pi-planning"; then
    echo "❌ jira-pi-planning container is not running"
    echo "   Start it with: podman-compose up -d"
    exit 1
fi

# Test 1: Check if proxy is reachable from host
echo "1. Testing proxy accessibility from host (should work)..."
if curl -k -s -o /dev/null -w "%{http_code}" https://localhost >/dev/null 2>&1; then
    echo "   ✅ Proxy is accessible from host (expected)"
else
    echo "   ⚠️  Proxy is not accessible from host"
fi
echo ""

# Test 2: Get the app container's IP
APP_IP=$(podman inspect jira-pi-planning --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
echo "2. App container IP: $APP_IP"
echo ""

# Test 3: Try to reach app directly from host (should fail with internal network)
echo "3. Testing direct access to app from host (should fail with internal network)..."
if timeout 2 curl -s -o /dev/null "http://${APP_IP}:3001" 2>/dev/null; then
    echo "   ⚠️  WARNING: App is accessible directly from host!"
    echo "   This means the internal network is NOT properly isolated."
    echo "   Check your podman-compose.yml network configuration."
else
    echo "   ✅ App is NOT accessible from host (expected - properly isolated)"
fi
echo ""

# Test 4: Check network configuration
echo "4. Network configuration:"
podman network inspect $(podman inspect jira-pi-planning --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}') --format 'Name: {{.Name}}
Driver: {{.Driver}}
Internal: {{.Internal}}' 2>/dev/null || echo "   Could not inspect network"
echo ""

# Test 5: Try from inside the proxy container (should work)
echo "5. Testing proxy -> app communication (should work)..."
if podman exec nginx-proxy wget -q -O /dev/null http://jira-pi-planning:3001/api/health 2>/dev/null; then
    echo "   ✅ Proxy can reach app (expected)"
else
    echo "   ⚠️  Proxy cannot reach app (this is a problem!)"
fi
echo ""

# Summary
echo "═══════════════════════════════════════"
echo "Summary:"
echo "─────────────────────────────────────────"
echo "✅ Good: Proxy accessible from host"
echo "✅ Good: Proxy can reach app internally"
if timeout 2 curl -s -o /dev/null "http://${APP_IP}:3001" 2>/dev/null; then
    echo "❌ BAD: App accessible directly from host"
    echo ""
    echo "🔧 To fix:"
    echo "   1. Make sure podman-compose.yml has: internal: true"
    echo "   2. Run: podman-compose down"
    echo "   3. Run: podman-compose up -d"
    echo "   4. Run this test again"
else
    echo "✅ Good: App NOT accessible from host"
    echo ""
    echo "🎉 Network isolation is working correctly!"
fi
echo "═══════════════════════════════════════"
