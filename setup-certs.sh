#!/bin/bash
# Script to generate self-signed SSL certificates for development
# For production, use Let's Encrypt or your certificate provider

echo "Generating self-signed SSL certificates for development..."
echo "For production, replace these with real certificates!"
echo ""

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/certs/key.pem \
    -out nginx/certs/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

chmod 600 nginx/certs/key.pem
chmod 644 nginx/certs/cert.pem

echo ""
echo "Certificates created in nginx/certs/"
echo "These are self-signed and will show browser warnings."
echo "For production, use Let's Encrypt or proper certificates."
