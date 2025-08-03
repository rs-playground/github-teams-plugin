#!/bin/bash

# Backstage startup script with Node.js 20+ compatibility
echo "🚀 Starting Backstage with Node.js 20+ compatibility..."
echo "Setting NODE_OPTIONS=--no-node-snapshot"

export NODE_OPTIONS=--no-node-snapshot

# Check if GitHub App is configured
if grep -q "YOUR_APP_ID" app-config.local.yaml 2>/dev/null; then
    echo "⚠️  Remember to configure your GitHub App in app-config.local.yaml"
else
    echo "✅ GitHub App configuration detected"
fi

echo "Starting Backstage..."
yarn start