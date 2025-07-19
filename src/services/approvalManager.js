const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const SelectionAlgorithm = require('./selectionAlgorithm');
const DatabaseQueries = require('../database/queries');

class ApprovalManager {
    constructor(client) {
        this.client = client;
        this.db = client.db;
        this.algorithm = new SelectionAlgorithm(this.db);
    }

    // Get approval channel ID from database
    async getApprovalChannelId() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM bot_config WHERE key = ?', ['APPROVAL_CHANNEL_ID'], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });
    }

    // Set approval channel ID
    async setApprovalChannelId(channelId) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
                ['APPROVAL_CHANNEL_ID', channelId, new Date().toISOString()], 
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Run selection and send for approval
    async runSelectionForApproval() {
        try {
            console.log('🎯 Running Monday selection for approval...');

            // Run selection algorithm
            const selectionData = await this.algorithm.runSelection();

            // Store as pending
            await this.algorithm.storePendingSelection(selectionData);

            // Set timeout for auto-approval (24 hours)
            const timeoutTime = new Date();
            timeoutTime.setHours(timeoutTime.getHours() + 24);
            await this.setSelectionTimeout(timeoutTime.toISOString());

            // Send to admin channel for approval
            await this.sendApprovalRequest(selectionData);

            console.log('✅ Selection sent for admin approval');
            return selectionData;

        } catch (error) {
            console.error('❌ Error running selection for approval:', error);
            throw error;
        }
    }

    // Send approval request to admin channel
    async sendApprovalRequest(selectionData) {
        const channelId = await this.getApprovalChannelId();
        if (!channelId) {
            console.error('❌ No approval channel set');
            return;
        }

        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                console.error('❌ Approval channel not found');
                return;
            }

            // Build approval embed
            const embed = await this.buildApprovalEmbed(selectionData);
            const buttons = this.buildApprovalButtons();

            const message = await channel.send({ embeds: [embed], components: [buttons] });

            // Store message ID for updates
            await this.setApprovalMessageId(message.id);

            console.log(`📤 Approval request sent to ${channel.name}`);

        } catch (error) {
            console.error('❌ Error sending approval request:', error);
        }
    }

    // Build approval embed
    async buildApprovalEmbed(selectionData) {
        const selectedText = selectionData.selected.map((p, i) => {
            const emoji = p.status === 'locked' ? '🔒' : '⏳';
            return `${i + 1}. ${emoji} **${p.username}** (${p.priorityScore} pts)`;
        }).join('\n');

        const backupText = selectionData.backup.slice(0, 5).map((p, i) => {
            return `${i + 1}. 🔄 **${p.username}** (${p.priorityScore} pts)`;
        }).join('\n');

        const scoresText = [...selectionData.selected, ...selectionData.backup.slice(0, 3)]
            .map(p => `**${p.username}**: ${p.priorityScore} pts`)
            .join(' • ');

        const timeoutTime = await this.getSelectionTimeout();
        const timeoutTimestamp = timeoutTime ? Math.floor(new Date(timeoutTime).getTime() / 1000) : null;

        const embed = new EmbedBuilder()
            .setTitle('🎯 WEEKLY SELECTION - ADMIN APPROVAL REQUIRED')
            .setDescription('Algorithm has generated this week\'s team selection')
            .addFields(
                {
                    name: '✅ SELECTED TEAM (4 players)',
                    value: selectedText || 'No players selected',
                    inline: false
                },
                {
                    name: '🔄 BACKUP QUEUE (Top 5)',
                    value: backupText || 'No backup players',
                    inline: false
                },
                {
                    name: '📊 Priority Scores',
                    value: scoresText,
                    inline: false
                },
                {
                    name: '⏰ Auto-Approval',
                    value: timeoutTimestamp ? `<t:${timeoutTimestamp}:R>` : 'Not set',
                    inline: true
                },
                {
                    name: '📅 Generated',
                    value: `<t:${Math.floor(new Date(selectionData.timestamp).getTime() / 1000)}:F>`,
                    inline: true
                }
            )
            .setColor(0xF39C12) // Orange for pending approval
            .setTimestamp();

        return embed;
    }

    // Build approval buttons
    buildApprovalButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('approve_selection')
                    .setLabel('✅ Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('regenerate_selection')
                    .setLabel('🔄 Regenerate')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('manual_edit_selection')
                    .setLabel('✏️ Manual Edit')
                    .setStyle(ButtonStyle.Primary)
            );
    }

    // Handle approval button clicks
    async handleApprovalButton(interaction) {
        const { customId } = interaction;

        try {
            switch (customId) {
                case 'approve_selection':
                    await this.approveSelection(interaction);
                    break;
                case 'regenerate_selection':
                    await this.regenerateSelection(interaction);
                    break;
                case 'manual_edit_selection':
                    await this.showManualEditModal(interaction);
                    break;
            }
        } catch (error) {
            console.error('❌ Error handling approval button:', error);
            await interaction.reply({
                content: '❌ Error processing request. Please try again.',
                ephemeral: true
            });
        }
    }

    // Approve selection
    async approveSelection(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const pendingSelection = await this.algorithm.getPendingSelection();
        if (!pendingSelection) {
            return await interaction.editReply({
                content: '❌ No pending selection found.'
            });
        }

        // Apply selection to current cycle
        await this.applySelection(pendingSelection);

        // Clear pending data
        await this.algorithm.clearPendingSelection();
        await this.clearSelectionTimeout();

        // Move to State 3 (Selection Results)
        await this.client.stateManager.forceState(3, `Selection approved by ${interaction.user.username}`);

        // Update approval message
        const approvedEmbed = new EmbedBuilder()
            .setTitle('✅ SELECTION APPROVED')
            .setDescription(`Approved by ${interaction.user.username}`)
            .setColor(0x57F287)
            .setTimestamp();

        await interaction.message.edit({ embeds: [approvedEmbed], components: [] });

        await interaction.editReply({
            content: '✅ Selection approved and applied! Moving to Results state.'
        });

        console.log(`✅ Selection approved by ${interaction.user.username}`);
    }

    // Regenerate selection
    async regenerateSelection(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Run new selection
            const newSelection = await this.algorithm.runSelection();
            await this.algorithm.storePendingSelection(newSelection);

            // Update approval message
            const newEmbed = await this.buildApprovalEmbed(newSelection);
            const newButtons = this.buildApprovalButtons();

            await interaction.message.edit({ embeds: [newEmbed], components: [newButtons] });

            await interaction.editReply({
                content: '🔄 New selection generated!'
            });

            console.log(`🔄 Selection regenerated by ${interaction.user.username}`);

        } catch (error) {
            await interaction.editReply({
                content: '❌ Error regenerating selection. Please try again.'
            });
        }
    }

    // Show manual edit modal (placeholder for Phase 3)
    async showManualEditModal(interaction) {
        await interaction.reply({
            content: '✏️ Manual edit modal will be implemented in Phase 3. For now, use regenerate or approve.',
            ephemeral: true
        });
    }

    // Apply selection to current cycle
    async applySelection(selectionData) {
        const queries = new DatabaseQueries(this.db);
        const currentCycle = await queries.getCurrentCycle();

        if (currentCycle) {
            await queries.updateCycleSelection(currentCycle.cycle_id, selectionData);
        } else {
            console.error('❌ No current cycle found to apply selection');
        }
    }

    // Timeout management
    async setSelectionTimeout(timeoutTime) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
                ['SELECTION_TIMEOUT', timeoutTime, new Date().toISOString()], 
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async getSelectionTimeout() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM bot_config WHERE key = ?', ['SELECTION_TIMEOUT'], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });
    }

    async clearSelectionTimeout() {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM bot_config WHERE key = ?', ['SELECTION_TIMEOUT'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async setApprovalMessageId(messageId) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)', 
                ['APPROVAL_MESSAGE_ID', messageId, new Date().toISOString()], 
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Check for auto-approval timeout
    async checkAutoApproval() {
        const timeoutTime = await this.getSelectionTimeout();
        if (!timeoutTime) return false;

        const now = new Date();
        const timeout = new Date(timeoutTime);

        if (now >= timeout) {
            console.log('⏰ Auto-approval timeout reached');
            
            const pendingSelection = await this.algorithm.getPendingSelection();
            if (pendingSelection) {
                await this.applySelection(pendingSelection);
                await this.algorithm.clearPendingSelection();
                await this.clearSelectionTimeout();

                // Move to State 3
                await this.client.stateManager.forceState(3, 'Auto-approval after 24hr timeout');

                console.log('✅ Selection auto-approved after timeout');
                return true;
            }
        }

        return false;
    }
}

module.exports = ApprovalManager;
