#!/bin/bash

# Script to set up Claude Code OAuth token for GitHub Actions

echo "Setting up Claude Code OAuth Token for GitHub Actions"
echo "======================================================="
echo ""
echo "You'll need a GitHub Personal Access Token with 'repo' and 'workflow' scopes."
echo "If you don't have one, create it at: https://github.com/settings/tokens"
echo ""
read -p "Enter your CLAUDE_CODE_OAUTH_TOKEN: " -s TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo "Error: Token cannot be empty"
    exit 1
fi

# Set the secret using gh CLI
echo "Setting secret in repository..."
echo "$TOKEN" | gh secret set CLAUDE_CODE_OAUTH_TOKEN -R rowhq/hitmachine

if [ $? -eq 0 ]; then
    echo "✅ Successfully set CLAUDE_CODE_OAUTH_TOKEN secret"
    echo ""
    echo "The Claude Code review workflow will now run automatically on:"
    echo "  - New pull requests"
    echo "  - Updates to existing PRs"
    echo ""
    echo "Check the workflow at: .github/workflows/claude-code-review.yml"
else
    echo "❌ Failed to set secret. Please check your permissions and try again."
    exit 1
fi