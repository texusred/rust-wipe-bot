#!/bin/bash

echo "Setting up Git repository..."

if [ ! -d ".git" ]; then
    git init
fi

cat > .gitignore << 'GITIGNORE'
.env
database.db
*.log
node_modules/
GITIGNORE

cat > README.md << 'README'
# Rust Wipe Discord Bot

Production-ready Discord bot for managing weekly Rust wipe player selection.

## Features
- Automated weekly selection (Monday 5AM EST)
- Priority scoring system with penalties
- Admin approval workflow
- Three-state embed system
- No-show penalty system
- Systemd service for production

## Admin Commands
- /admin runselection
- /admin cancelselection 
- /admin viewscores
- /admin marknoshow
- /admin lockplayer
- /admin setstate

## Current Status
- 8 active players
- Week 2 active
- All systems operational
README

git add .

if [ -z "$(git log --oneline 2>/dev/null)" ]; then
    git commit -m "Initial commit"
fi

echo "Git setup complete!"
