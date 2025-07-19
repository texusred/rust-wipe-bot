const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DatabaseQueries = require('../database/queries');
const SelectionAlgorithm = require('../services/selectionAlgorithm');
const WipeEmbedBuilder = require('../embeds/wipeEmbed');
const ApprovalManager = require('../services/approvalManager');

const ADMIN_ROLES = ['661441458804621332', '661441014535553044'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin commands for wipe management')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Set the persistent embed channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for persistent embed')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setapprovalchannel')
                .setDescription('Set channel for selection approval requests')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for approval notifications')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('runselection')
                .setDescription('Manually trigger selection process'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancelselection')
                .setDescription('Cancel pending selection and clear approval request'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('viewscores')
                .setDescription('View all player priority scores'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addplayer')
                .setDescription('Add player to the pool')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removeplayer')
                .setDescription('Remove player from pool')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Player to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('updateembed')
                .setDescription('Force update persistent embed'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('lockplayer')
                .setDescription('Lock a player to slot 1')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Player to lock')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlockplayer')
                .setDescription('Remove current locked player'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('marknoshow')
                .setDescription('Mark a player as no-show for last wipe')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Player who did not show up')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setstate')
                .setDescription('Manually set embed state for testing')
                .addIntegerOption(option =>
                    option.setName('state')
                        .setDescription('State to set')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Wipe in Progress', value: 1 },
                            { name: 'Pre-Selection', value: 2 },
                            { name: 'Selection Results', value: 3 }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('viewstate')
                .setDescription('View current state information'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resetstate')
                .setDescription('Reset state to automatic calculation'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const hasAdminRole = interaction.member.roles.cache.some(role => ADMIN_ROLES.includes(role.id));
        if (!hasAdminRole) {
            return await interaction.reply({
                content: '❌ You need admin permissions to use this command.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const db = interaction.client.db;
        const queries = new DatabaseQueries(db);

        try {
            switch (subcommand) {
                case 'setchannel':
                    const channel = interaction.options.getChannel('channel');
                    await interaction.client.persistentEmbed.setPersistentChannel(channel.id);
                    await interaction.reply({
                        content: `✅ Persistent embed set in ${channel}`,
                        ephemeral: true
                    });
                    break;

                case 'setapprovalchannel':
                    const approvalChannel = interaction.options.getChannel('channel');
                    const approvalManager = new ApprovalManager(interaction.client);
                    
                    await approvalManager.setApprovalChannelId(approvalChannel.id);
                    
                    await interaction.reply({
                        content: `✅ Approval channel set to ${approvalChannel}`,
                        ephemeral: true
                    });
                    break;

                case 'runselection':
                    await interaction.deferReply({ ephemeral: true });
                    
                    const manager = new ApprovalManager(interaction.client);
                    
                    try {
                        await manager.runSelectionForApproval();
                        await interaction.editReply({
                            content: '✅ Selection algorithm completed and sent for approval!'
                        });
                    } catch (error) {
                        console.error('Selection error:', error);
                        await interaction.editReply({
                            content: '❌ Error running selection algorithm.'
                        });
                    }
                    break;

                case 'cancelselection':
                    await interaction.deferReply({ ephemeral: true });
                    
                    const cancelManager = new ApprovalManager(interaction.client);
                    
                    try {
                        // Check if there's a pending selection
                        const pendingSelection = await cancelManager.algorithm.getPendingSelection();
                        if (!pendingSelection) {
                            return await interaction.editReply({
                                content: '❌ No pending selection to cancel.'
                            });
                        }

                        // Clear pending selection data
                        await cancelManager.algorithm.clearPendingSelection();
                        await cancelManager.clearSelectionTimeout();

                        // Try to update approval message to show cancellation
                        const channelId = await cancelManager.getApprovalChannelId();
                        if (channelId) {
                            try {
                                const channel = await interaction.client.channels.fetch(channelId);
                                
                                const cancelledEmbed = new EmbedBuilder()
                                    .setTitle('❌ SELECTION CANCELLED')
                                    .setDescription(`Selection cancelled by ${interaction.user.username}`)
                                    .setColor(0xE74C3C)
                                    .setTimestamp();

                                // Find the most recent approval message and update it
                                const messages = await channel.messages.fetch({ limit: 10 });
                                const approvalMessage = messages.find(m => 
                                    m.author.id === interaction.client.user.id && 
                                    m.embeds[0]?.title?.includes('ADMIN APPROVAL REQUIRED')
                                );

                                if (approvalMessage) {
                                    await approvalMessage.edit({ embeds: [cancelledEmbed], components: [] });
                                }
                            } catch (error) {
                                console.error('Error updating approval message:', error);
                            }
                        }

                        await interaction.editReply({
                            content: '✅ Pending selection cancelled successfully!'
                        });

                        console.log(`❌ Selection cancelled by ${interaction.user.username}`);

                    } catch (error) {
                        console.error('Cancel selection error:', error);
                        await interaction.editReply({
                            content: '❌ Error cancelling selection.'
                        });
                    }
                    break;

                case 'marknoshow':
                    const noShowUser = interaction.options.getUser('user');
                    
                    // Check if player exists
                    const player = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM players WHERE discord_id = ?', [noShowUser.id], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });

                    if (!player) {
                        return await interaction.reply({
                            content: `❌ ${noShowUser.username} is not in the player pool.`,
                            ephemeral: true
                        });
                    }

                    // Get most recent completed cycle
                    const lastCycle = await new Promise((resolve, reject) => {
                        db.get(`
                            SELECT * FROM wipe_cycles 
                            WHERE status = 'completed' 
                            ORDER BY cycle_id DESC LIMIT 1
                        `, (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });

                    if (!lastCycle) {
                        return await interaction.reply({
                            content: '❌ No completed wipe cycles found.',
                            ephemeral: true
                        });
                    }

                    // Check if player has history for that cycle
                    const existingHistory = await new Promise((resolve, reject) => {
                        db.get(`
                            SELECT * FROM player_history 
                            WHERE player_id = ? AND cycle_id = ?
                        `, [noShowUser.id, lastCycle.cycle_id], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });

                    if (existingHistory) {
                        // Update existing record to mark as no-show
                        await new Promise((resolve, reject) => {
                            db.run(`
                                UPDATE player_history 
                                SET participated = 0, no_show = 1 
                                WHERE player_id = ? AND cycle_id = ?
                            `, [noShowUser.id, lastCycle.cycle_id], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    } else {
                        // Create new record for no-show
                        await new Promise((resolve, reject) => {
                            db.run(`
                                INSERT INTO player_history (player_id, cycle_id, participated, no_show, timestamp)
                                VALUES (?, ?, 0, 1, ?)
                            `, [noShowUser.id, lastCycle.cycle_id, lastCycle.start_date + ' 19:00:00'], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    }

                    // Decrease total games played if they were counted as participated
                    if (existingHistory && existingHistory.participated) {
                        await new Promise((resolve, reject) => {
                            db.run(`
                                UPDATE players 
                                SET total_games_played = MAX(0, total_games_played - 1) 
                                WHERE discord_id = ?
                            `, [noShowUser.id], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    }

                    await interaction.reply({
                        content: `⚠️ ${noShowUser.username} marked as no-show for ${lastCycle.start_date}. This will negatively impact their priority score.`,
                        ephemeral: true
                    });

                    setTimeout(async () => {
                        try {
                            await interaction.deleteReply();
                        } catch (err) {
                            console.log('Could not delete reply:', err.message);
                        }
                    }, 30000);
                    break;

                case 'viewscores':
                    const players = await queries.getAllPlayers();
                    const scores = [];

                    for (const player of players) {
                        const score = await queries.calculatePriorityScore(player.discord_id);
                        scores.push({
                            username: player.username,
                            discord_id: player.discord_id,
                            score: score.totalScore,
                            breakdown: score
                        });
                    }

                    scores.sort((a, b) => b.score - a.score);

                    const scoreText = scores.map((s, i) => {
                        const locked = s.breakdown.locked ? '🔒' : '';
                        const noShow = s.breakdown.recentNoShows > 0 ? '⚠️' : '';
                        return `${i + 1}. ${locked}${noShow}<@${s.discord_id}> - **${s.score}** pts`;
                    }).join('\n');

                    const scoresEmbed = new EmbedBuilder()
                        .setTitle('📊 Player Priority Scores')
                        .setDescription(scoreText || 'No active players')
                        .setFooter({ text: '⚠️ = Recent no-show penalty' })
                        .setColor(0x3498DB);

                    await interaction.reply({ embeds: [scoresEmbed], ephemeral: true });

                    setTimeout(async () => {
                        try {
                            await interaction.deleteReply();
                        } catch (err) {
                            console.log('Could not delete reply:', err.message);
                        }
                    }, 30000);
                    break;

                case 'addplayer':
                    const user = interaction.options.getUser('user');

                    const existingPlayer = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM players WHERE discord_id = ?', [user.id], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });

                    if (existingPlayer) {
                        return await interaction.reply({
                            content: `❌ ${user.username} is already in the player pool.`,
                            ephemeral: true
                        });
                    }

                    await new Promise((resolve, reject) => {
                        db.run(`
                            INSERT INTO players (discord_id, username, join_date, total_games_played)
                            VALUES (?, ?, CURRENT_DATE, 0)
                        `, [user.id, user.username], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    await interaction.reply({
                        content: `✅ ${user.username} added to player pool.`,
                        ephemeral: true
                    });
                    break;

                case 'updateembed':
                    if (interaction.client.persistentEmbed) {
                        await interaction.client.persistentEmbed.forceUpdate();
                        await interaction.reply({
                            content: '✅ Persistent embed updated.',
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ No persistent embed set. Use `/admin setchannel` first.',
                            ephemeral: true
                        });
                    }
                    break;

                case 'lockplayer':
                    const userToLock = interaction.options.getUser('user');

                    const currentLocked = await new Promise((resolve, reject) => {
                        db.get('SELECT discord_id, username FROM players WHERE locked = 1', (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });

                    if (currentLocked) {
                        return await interaction.reply({
                            content: `❌ ${currentLocked.username} is already locked. Use \`/admin unlockplayer\` first.`,
                            ephemeral: true
                        });
                    }

                    const playerToLock = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM players WHERE discord_id = ?', [userToLock.id], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });

                    if (!playerToLock) {
                        return await interaction.reply({
                            content: `❌ ${userToLock.username} is not in the active player pool.`,
                            ephemeral: true
                        });
                    }

                    await new Promise((resolve, reject) => {
                        db.run('UPDATE players SET locked = 1 WHERE discord_id = ?', [userToLock.id], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    await interaction.reply({
                        content: `🔒 ${userToLock.username} is now locked to slot 1 for all future selections.`,
                        ephemeral: true
                    });

                    setTimeout(async () => {
                        try {
                            await interaction.deleteReply();
                        } catch (err) {
                            console.log('Could not delete reply:', err.message);
                        }
                    }, 30000);
                    break;

                case 'unlockplayer':
                    const lockedPlayer = await new Promise((resolve, reject) => {
                        db.get('SELECT discord_id, username FROM players WHERE locked = 1', (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });

                    if (!lockedPlayer) {
                        return await interaction.reply({
                            content: `❌ No player is currently locked.`,
                            ephemeral: true
                        });
                    }

                    await new Promise((resolve, reject) => {
                        db.run('UPDATE players SET locked = 0 WHERE locked = 1', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    await interaction.reply({
                        content: `🔓 ${lockedPlayer.username} is no longer locked.`,
                        ephemeral: true
                    });

                    setTimeout(async () => {
                        try {
                            await interaction.deleteReply();
                        } catch (err) {
                            console.log('Could not delete reply:', err.message);
                        }
                    }, 30000);
                    break;

                case 'removeplayer':
                    const userToRemove = interaction.options.getUser('user');

                    const playerToRemove = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM players WHERE discord_id = ?', [userToRemove.id], (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });

                    if (!playerToRemove) {
                        return await interaction.reply({
                            content: `❌ ${userToRemove.username} is not in the player pool.`,
                            ephemeral: true
                        });
                    }

                    await new Promise((resolve, reject) => {
                        db.run('DELETE FROM players WHERE discord_id = ?', [userToRemove.id], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    await interaction.reply({
                        content: `🗑️ ${userToRemove.username} removed from player pool.`,
                        ephemeral: true
                    });

                    setTimeout(async () => {
                        try {
                            await interaction.deleteReply();
                        } catch (err) {
                            console.log('Could not delete reply:', err.message);
                        }
                    }, 30000);
                    break;

                case 'setstate':
                    const newState = interaction.options.getInteger('state');
                    const stateManager = interaction.client.stateManager;
                    
                    if (!stateManager) {
                        return await interaction.reply({
                            content: '❌ State manager not initialized.',
                            ephemeral: true
                        });
                    }

                    await stateManager.forceState(newState, `Manual override by ${interaction.user.username}`);

                    const stateNames = {
                        1: 'Wipe in Progress',
                        2: 'Pre-Selection', 
                        3: 'Selection Results'
                    };

                    await interaction.reply({
                        content: `✅ State manually set to: **${stateNames[newState]}** (${newState})`,
                        ephemeral: true
                    });
                    break;

                case 'viewstate':
                    const sm = interaction.client.stateManager;
                    
                    if (!sm) {
                        return await interaction.reply({
                            content: '❌ State manager not initialized.',
                            ephemeral: true
                        });
                    }

                    const currentState = await sm.getCurrentState();
                    const correctState = sm.calculateCorrectState();
                    const nextTransition = sm.getNextTransitionTime();

                    const stateEmbed = new EmbedBuilder()
                        .setTitle('📊 State Manager Information')
                        .addFields(
                            {
                                name: 'Current State',
                                value: `**${sm.STATE_NAMES[currentState]}** (${currentState})`,
                                inline: true
                            },
                            {
                                name: 'Calculated State',
                                value: `**${sm.STATE_NAMES[correctState]}** (${correctState})`,
                                inline: true
                            },
                            {
                                name: 'States Match?',
                                value: currentState === correctState ? '✅ Yes' : '❌ No (manual override active)',
                                inline: true
                            },
                            {
                                name: 'Next Transition',
                                value: `<t:${Math.floor(nextTransition.getTime() / 1000)}:F>`,
                                inline: false
                            },
                            {
                                name: 'Time Until Transition',
                                value: `<t:${Math.floor(nextTransition.getTime() / 1000)}:R>`,
                                inline: false
                            }
                        )
                        .setColor(currentState === correctState ? 0x57F287 : 0xF39C12)
                        .setTimestamp();

                    await interaction.reply({ embeds: [stateEmbed], ephemeral: true });
                    break;

                case 'resetstate':
                    const resetSM = interaction.client.stateManager;
                    
                    if (!resetSM) {
                        return await interaction.reply({
                            content: '❌ State manager not initialized.',
                            ephemeral: true
                        });
                    }

                    const autoState = resetSM.calculateCorrectState();
                    await resetSM.forceState(autoState, `Reset to automatic by ${interaction.user.username}`);

                    await interaction.reply({
                        content: `✅ State reset to automatic calculation: **${resetSM.STATE_NAMES[autoState]}** (${autoState})`,
                        ephemeral: true
                    });
                    break;

                default:
                    await interaction.reply({
                        content: '❌ Unknown admin command.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Admin command error:', error);
            await interaction.reply({
                content: '❌ An error occurred executing the admin command.',
                ephemeral: true
            });
        }
    }
};
