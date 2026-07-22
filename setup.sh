#!/bin/bash
# Setup script for JIRA PI Planning with Proxy

set -e

echo "🚀 Setting up JIRA PI Planning with Nginx Proxy..."
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your JIRA credentials."
    echo ""
fi

# Setup JIRA PAT secret
echo "Setting up JIRA PAT as a Podman secret (recommended for security)..."
if ! podman secret inspect jira_pat &>/dev/null; then
    echo "Creating JIRA PAT secret..."
    ./setup-secret.sh create
else
    echo "✅ JIRA PAT secret already exists."
    echo "   To update: ./setup-secret.sh update"
fi
echo ""

# Generate certificates
echo "1. Generating self-signed SSL certificates..."
./setup-certs.sh
echo ""

# Create basic auth
echo "2. Setting up HTTP Basic Auth..."
echo "   This adds an additional security layer on top of your app."
./setup-auth.sh
echo ""

# Build and start services
echo "3. Building and starting containers..."
podman-compose build
podman-compose up -d
echo ""

# Wait a moment for containers to start
sleep 3

# Check status
echo "4. Checking container status..."
podman-compose ps
echo ""

echo "✅ Setup complete!"
echo ""
echo "🌐 Access your application:"
echo "   URL: https://localhost"
echo "   Username: (the one you just created)"
echo "   Password: (the password you just created)"
echo ""
echo "⚠️  Your browser will warn about the self-signed certificate - this is normal."
echo "    For production, replace the certificates in nginx/certs/ with real ones."
echo ""
echo "📋 Useful commands:"
echo "   View logs:     podman-compose logs -f"
echo "   App logs:      podman-compose logs -f jira-pi-planning"
echo "   Proxy logs:    podman-compose logs -f proxy"
echo "   Stop:          podman-compose down"
echo "   Restart:       podman-compose restart"
echo ""
