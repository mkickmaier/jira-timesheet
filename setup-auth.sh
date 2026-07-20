#!/bin/bash
# Script to create HTTP basic auth credentials

echo "Creating HTTP Basic Auth credentials..."
echo "Enter username:"
read username

# Create htpasswd file (requires httpd-tools/apache2-utils)
if command -v htpasswd &> /dev/null; then
    htpasswd -c nginx/.htpasswd "$username"
elif command -v podman &> /dev/null; then
    # Use a container if htpasswd is not available locally
    echo "Enter password:"
    read -s password
    podman run --rm -it docker.io/httpd:alpine htpasswd -nb "$username" "$password" > nginx/.htpasswd
else
    echo "Error: htpasswd command not found and podman not available"
    exit 1
fi

echo "Credentials created in nginx/.htpasswd"
