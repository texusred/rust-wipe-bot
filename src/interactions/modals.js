const { EmbedBuilder } = require('discord.js');
const DatabaseQueries = require('../database/queries');
const ApprovalManager = require('../services/approvalManager');

module.exports = {
    async handleManualSelectionModal(interaction) {
        try {
            // Get form data
            const slot1 = interaction.fields.getTextInputValue('slot1');
            const slot2 = interaction.fields.getTextInputValue('slot2');
            const slot3 = interaction.fields.getTextInputValue('slot3');
            const slot4 = interaction.fields.getTextInputValue('slot4');
            const backupPlayers = interaction.fields.getTextInputValue('backup');
            
            const db = interaction.client.db;
            const queries = new DatabaseQueries(db);
            const approvalManager = new ApprovalManager(interaction.client);
            
            // Get all players for validation
            const allPlayers = await queries.getAllPlayers();
            const playerMap = new Map();
            allPlayers.forEach(p => {
                playerMap.set(p.username.toLowerCase(), p);
                playerMap.set(p.discord_id, p);
            });
            
            // Validate and build selected team
            const selectedPlayers = [];
            const slots = [slot1, slot2, slot3, slot4];
            
            for (let i = 0; i < slots.length; i++) {
                const playerInput = slots[i].trim();
                if (!playerInput) {
                    return await interaction.reply({
                        content: `❌ Slot ${i + 1} cannot be empty.`,
                        ephemeral: true
                    });
                }
                
                // Find player by username or Discord ID
                const player = playerMap.get(playerInput.toLowerCase()) || 
                               playerMap.get(playerInput);
                               
                if (!player) {
                    return await interaction.reply({
                        content: `❌ Player "${playerInput}" not found in active pool.`,
                        ephemeral: true
                    });
                }
                
                // Check for duplicates
                if (selectedPlayers.find(p => p.discord_id === player.discord_id)) {
                    return await interaction.reply({
                        content: `❌ Player "${player.username}" is already selected for another slot.`,
                        ephemeral: true
                    });
                }
                
                // Calculate their priority score
                const scoreData = await queries.calculatePriorityScore(player.discord_id);
                
                selectedPlayers.push({
                    discord_id: player.discord_id,
                    username: player.username,
                    status: player.locked ? 'locked' : 'pending',
                    priorityScore: scoreData.totalScore,
                    scoreBreakdown: scoreData.breakdown
                });
            }
            
            // Process backup queue
            const backupQueue = [];
            if (backupPlayers.trim()) {
                const backupList = backupPlayers.split(',').map(p => p.trim()).filter(p => p);
                
                for (const playerInput of backupList) {
                    const player = playerMap.get(playerInput.toLowerCase()) || 
                                   playerMap.get(playerInput);
                                   
                    if (!player) {
                        return await interaction.reply({
                            content: `❌ Backup player "${playerInput}" not found in active pool.`,
                            ephemeral: true
                        });
                    }
                    
                    // Check not already selected
                    if (selectedPlayers.find(p => p.discord_id === player.discord_id)) {
                        return await interaction.reply({
                            content: `❌ Player "${player.username}" is already in the selected team.`,
                            ephemeral: true
                        });
                    }
                    
                    // Check not already in backup
                    if (backupQueue.find(p => p.discord_id === player.discord_id)) {
                        return await interaction.reply({
                            content: `❌ Player "${player.username}" is already in the backup queue.`,
                            ephemeral: true
                        });
                    }
                    
                    const scoreData = await queries.calculatePriorityScore(player.discord_id);
                    
                    backupQueue.push({
                        discord_id: player.discord_id,
                        username: player.username,
                        status: 'backup',
                        priorityScore: scoreData.totalScore,
                        scoreBreakdown: scoreData.breakdown
                    });
                }
            }
            
            // Create manual selection data
            const manualSelection = {
                selected: selectedPlayers,
                backup: backupQueue,
                timestamp: new Date().toISOString(),
                algorithm_version: 'manual',
                admin_override: interaction.user.username
            };
            
            // Store as pending selection
            await approvalManager.algorithm.storePendingSelection(manualSelection);
            
            // Update the approval message with new selection
            const newEmbed = await approvalManager.buildApprovalEmbed(manualSelection);
            const newButtons = approvalManager.buildApprovalButtons();
            
            // Find and update the original approval message
            const channelId = await approvalManager.getApprovalChannelId();
            if (channelId) {
                const channel = await interaction.client.channels.fetch(channelId);
                const messages = await channel.messages.fetch({ limit: 10 });
                const approvalMessage = messages.find(m => 
                    m.author.id === interaction.client.user.id && 
                    m.embeds[0]?.title?.includes('ADMIN APPROVAL REQUIRED')
                );
                
                if (approvalMessage) {
                    await approvalMessage.edit({ embeds: [newEmbed], components: [newButtons] });
                }
            }
            
            await interaction.reply({
                content: `✅ Manual selection created successfully!\n\n**Selected Team:**\n${selectedPlayers.map((p, i) => `${i + 1}. ${p.username}`).join('\n')}\n\n**Backup Queue:**\n${backupQueue.map((p, i) => `${i + 1}. ${p.username}`).join('\n') || 'None'}`,
                ephemeral: true
            });
            
            console.log(`✏️ Manual selection created by ${interaction.user.username}`);
            
        } catch (error) {
            console.error('Error handling manual selection modal:', error);
            await interaction.reply({
                content: '❌ Error processing manual selection. Please try again.',
                ephemeral: true
            });
        }
    }
};
