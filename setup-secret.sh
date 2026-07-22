#!/bin/bash
# Script to create and manage Podman secrets for JIRA PAT

set -e

SECRET_NAME="jira_pat"

function show_help() {
    echo "Usage: $0 [create|update|delete|show]"
    echo ""
    echo "Commands:"
    echo "  create  - Create a new JIRA PAT secret"
    echo "  update  - Update existing JIRA PAT secret (removes and recreates)"
    echo "  delete  - Delete the JIRA PAT secret"
    echo "  show    - Show if the secret exists (doesn't reveal the value)"
    echo ""
}

function create_secret() {
    # Check if secret already exists
    if podman secret inspect "$SECRET_NAME" &>/dev/null; then
        echo "❌ Secret '$SECRET_NAME' already exists."
        echo "   Use '$0 update' to change it or '$0 delete' to remove it."
        exit 1
    fi

    echo "Creating Podman secret for JIRA PAT..."
    echo ""
    echo "Enter your JIRA Personal Access Token (PAT):"
    read -s jira_pat
    echo ""
    
    if [ -z "$jira_pat" ]; then
        echo "❌ PAT cannot be empty"
        exit 1
    fi

    # Create the secret
    echo -n "$jira_pat" | podman secret create "$SECRET_NAME" -
    
    echo "✅ Secret '$SECRET_NAME' created successfully!"
    echo ""
    echo "The secret is now available to containers and will be mounted at:"
    echo "   /run/secrets/$SECRET_NAME"
}

function update_secret() {
    echo "Updating JIRA PAT secret..."
    echo ""
    
    # Check if secret exists
    if ! podman secret inspect "$SECRET_NAME" &>/dev/null; then
        echo "❌ Secret '$SECRET_NAME' does not exist. Use '$0 create' first."
        exit 1
    fi

    # Check if any containers are using the secret
    if podman ps -a --filter "volume=$SECRET_NAME" --format "{{.Names}}" | grep -q .; then
        echo "⚠️  Warning: Some containers might be using this secret."
        echo "   You should stop them first: podman-compose down"
        read -p "Continue anyway? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo "Cancelled."
            exit 0
        fi
    fi

    # Delete old secret
    echo "Removing old secret..."
    podman secret rm "$SECRET_NAME"
    
    # Create new one
    echo "Enter your new JIRA Personal Access Token (PAT):"
    read -s jira_pat
    echo ""
    
    if [ -z "$jira_pat" ]; then
        echo "❌ PAT cannot be empty"
        exit 1
    fi

    echo -n "$jira_pat" | podman secret create "$SECRET_NAME" -
    
    echo "✅ Secret '$SECRET_NAME' updated successfully!"
    echo ""
    echo "Remember to restart your containers:"
    echo "   podman-compose restart"
}

function delete_secret() {
    if ! podman secret inspect "$SECRET_NAME" &>/dev/null; then
        echo "❌ Secret '$SECRET_NAME' does not exist."
        exit 1
    fi

    echo "⚠️  Warning: This will permanently delete the JIRA PAT secret."
    read -p "Are you sure? (y/N): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        podman secret rm "$SECRET_NAME"
        echo "✅ Secret '$SECRET_NAME' deleted."
    else
        echo "Cancelled."
    fi
}

function show_secret() {
    if podman secret inspect "$SECRET_NAME" &>/dev/null; then
        echo "✅ Secret '$SECRET_NAME' exists"
        podman secret inspect "$SECRET_NAME" --format "Created: {{.CreatedAt}}"
        podman secret inspect "$SECRET_NAME" --format "ID: {{.ID}}"
        echo ""
        echo "Note: The actual secret value is encrypted and cannot be retrieved."
    else
        echo "❌ Secret '$SECRET_NAME' does not exist."
        echo "   Create it with: $0 create"
    fi
}

# Main logic
case "${1:-}" in
    create)
        create_secret
        ;;
    update)
        update_secret
        ;;
    delete)
        delete_secret
        ;;
    show)
        show_secret
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        show_help
        exit 1
        ;;
esac
