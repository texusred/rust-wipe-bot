#!/bin/bash

echo "🔧 Setting up Rust Wipe Bot systemd service..."

# Create log directory
sudo mkdir -p /var/log/rust-wipe-bot
sudo chown lightning:lightning /var/log/rust-wipe-bot

# Copy service file to systemd
sudo cp rust-wipe-bot.service /etc/systemd/system/

# Set proper permissions
sudo chmod 644 /etc/systemd/system/rust-wipe-bot.service

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable rust-wipe-bot

echo "✅ Service installed successfully!"
echo ""
echo "📋 Available commands:"
echo "  Start:   sudo systemctl start rust-wipe-bot"
echo "  Stop:    sudo systemctl stop rust-wipe-bot"
echo "  Restart: sudo systemctl restart rust-wipe-bot"
echo "  Status:  sudo systemctl status rust-wipe-bot"
echo "  Logs:    sudo journalctl -u rust-wipe-bot -f"
echo ""
echo "🚀 To start the bot now, run:"
echo "  sudo systemctl start rust-wipe-bot"
