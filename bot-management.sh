#!/bin/bash

# Rust Wipe Bot Management Script

case "$1" in
    start)
        echo "🚀 Starting Rust Wipe Bot..."
        sudo systemctl start rust-wipe-bot
        sleep 2
        sudo systemctl status rust-wipe-bot --no-pager -l
        ;;
    stop)
        echo "⏹️  Stopping Rust Wipe Bot..."
        sudo systemctl stop rust-wipe-bot
        sleep 1
        echo "✅ Bot stopped"
        ;;
    restart)
        echo "🔄 Restarting Rust Wipe Bot..."
        sudo systemctl restart rust-wipe-bot
        sleep 2
        sudo systemctl status rust-wipe-bot --no-pager -l
        ;;
    status)
        echo "📊 Rust Wipe Bot Status:"
        sudo systemctl status rust-wipe-bot --no-pager -l
        ;;
    logs)
        echo "📋 Live logs (Ctrl+C to exit):"
        sudo journalctl -u rust-wipe-bot -f
        ;;
    enable)
        echo "🔧 Enabling auto-start on boot..."
        sudo systemctl enable rust-wipe-bot
        echo "✅ Bot will now start automatically on server boot"
        ;;
    disable)
        echo "❌ Disabling auto-start on boot..."
        sudo systemctl disable rust-wipe-bot
        echo "✅ Bot will no longer start automatically on boot"
        ;;
    *)
        echo "🤖 Rust Wipe Bot Management"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|enable|disable}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the bot"
        echo "  stop     - Stop the bot"
        echo "  restart  - Restart the bot"
        echo "  status   - Show bot status"
        echo "  logs     - Show live logs"
        echo "  enable   - Enable auto-start on boot"
        echo "  disable  - Disable auto-start on boot"
        echo ""
        exit 1
        ;;
esac
