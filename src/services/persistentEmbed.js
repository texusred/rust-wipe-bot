const WipeEmbedBuilder = require('../embeds/wipeEmbed');

class PersistentEmbedManager {
    constructor(client) {
        this.client = client;
        this.channelId = null;
        this.messageId = null;
        this.updateInterval = null;
    }

    async setPersistentChannel(channelId) {
        this.channelId = channelId;
        // Store in database for persistence
        await this.setConfig('PERSISTENT_CHANNEL_ID', channelId);
        
        // Create initial embed
        await this.createOrUpdateEmbed();
        
        // Start auto-update timer (every 30 seconds)
        this.startAutoUpdate();
        
        console.log(`✅ Persistent embed set for channel: ${channelId}`);
    }

    async createOrUpdateEmbed() {
        if (!this.channelId) return;

        try {
            const channel = await this.client.channels.fetch(this.channelId);
            if (!channel) {
                console.error('Persistent channel not found');
                return;
            }

            const db = this.client.db;
            const embedData = await WipeEmbedBuilder.buildPersistentEmbed(this.client, db);

            if (this.messageId) {
                // Update existing message
                try {
                    const message = await channel.messages.fetch(this.messageId);
                    await message.edit(embedData);
                } catch (error) {
                    // Message not found, create new one
                    console.log('Previous message not found, creating new embed');
                    this.messageId = null;
                    await this.createOrUpdateEmbed();
                }
            } else {
                // Create new message
                const message = await channel.send(embedData);
                this.messageId = message.id;
                await this.setConfig('PERSISTENT_MESSAGE_ID', message.id);
                console.log(`📌 Created persistent embed: ${message.id}`);
            }
        } catch (error) {
            console.error('Error updating persistent embed:', error);
        }
    }

    startAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Update every 30 seconds
        this.updateInterval = setInterval(async () => {
            await this.createOrUpdateEmbed();
        }, 30000);
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Database helper functions
    async setConfig(key, value) {
        return new Promise((resolve, reject) => {
            const stmt = this.client.db.prepare(`
                INSERT OR REPLACE INTO bot_config (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(key, value, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async getConfig(key) {
        return new Promise((resolve, reject) => {
            this.client.db.get('SELECT value FROM bot_config WHERE key = ?', [key], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });
    }

    // Initialize from stored data on bot restart
    async initialize() {
        try {
            this.channelId = await this.getConfig('PERSISTENT_CHANNEL_ID');
            this.messageId = await this.getConfig('PERSISTENT_MESSAGE_ID');
            
            if (this.channelId) {
                await this.createOrUpdateEmbed();
                this.startAutoUpdate();
                console.log('✅ Persistent embed manager initialized');
            }
        } catch (error) {
            console.error('Error initializing persistent embed manager:', error);
        }
    }

    // Force immediate update (called after selections, confirmations, etc)
    async forceUpdate() {
        await this.createOrUpdateEmbed();
    }
}

module.exports = PersistentEmbedManager;
