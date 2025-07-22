const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DatabaseQueries = require('../database/queries');
const SelectionAlgorithm = require('../services/selectionAlgorithm');
const WipeEmbedBuilder = require('../embeds/wipeEmbed');

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
                .setName('runselection')
                .setDescription('Manually run player selection'))
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Check admin roles
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
                    
                    if (!interaction.client.persistentEmbed) {
                        return await interaction.reply({
                            content: '❌ Persistent embed manager not initialized!',
                            ephemeral: true
                        });
                    }
                    
                    await interaction.deferReply({ ephemeral: true });
                    
                    try {
                        await interaction.client.persistentEmbed.setPersistentChannel(channel.id);
                        
                        await interaction.editReply({
                            content: `✅ Persistent embed set in ${channel}. Auto-updates every 30 seconds.`,
                            ephemeral: true
                        });
                    } catch (error) {
                        console.error('Error setting persistent channel:', error);
                        await interaction.editReply({ content: '❌ Error setting persistent channel!' });
                    }
                    break;

                case 'runselection':
                    const algorithm = new SelectionAlgorithm(db);
                    
                    // Create new cycle first
                    const startDate = new Date().toISOString().split('T')[0];
                    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    const cycleId = await queries.createNewCycle(startDate, endDate);
                    
                    const result = await algorithm.selectPlayers(cycleId);
                    
                    if (result.requiresAdminSelection) {
                        // Create tie-breaking interface
                        await this.handleTieBreaking(interaction, result);
                    } else {
                        // Save selection and notify
                        await queries.updateCycleSelection(cycleId, {
                            selected: result.selected,
                            backup: result.backup
                        });
                        
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Selection Complete')
                            .setDescription('Players have been selected automatically.')
                            .addFields(
                                {
                                    name: 'Selected Players',
                                    value: result.selected.map((p, i) => `${i + 1}. <@${p.discord_id}>`).join('\n'),
                                    inline: false
                                }
                            )
                            .setColor(0x57F287);
                        
                        await interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    break;

                case 'viewscores':
                    const players = await queries.getAllPlayers();
                    const scores = [];
                    
                    for (const player of players) {
                        if (!player.active) continue;
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
                        return `${i + 1}. ${locked}<@${s.discord_id}> - **${s.score}** pts`;
                    }).join('\n');
                    
                    const scoresEmbed = new EmbedBuilder()
                        .setTitle('📊 Player Priority Scores')
                        .setDescription(scoreText || 'No active players')
                        .setColor(0x3498DB);
                    
                    await interaction.reply({ embeds: [scoresEmbed], ephemeral: true });
                    break;

                case 'addplayer':
                    const user = interaction.options.getUser('user');
                    
                    const existingPlayer = await db.get('SELECT * FROM players WHERE discord_id = ?', [user.id]);
                    if (existingPlayer) {
                        return await interaction.reply({
                            content: `❌ ${user.username} is already in the player pool.`,
                            ephemeral: true
                        });
                    }
                    
                    await db.run(`
                        INSERT INTO players (discord_id, username, join_date, total_games_played, active)
                        VALUES (?, ?, CURRENT_DATE, 0, 1)
                    `, [user.id, user.username]);
                    
                    await interaction.reply({
                        content: `✅ ${user.username} added to player pool.`,
                        ephemeral: true
                    });
                    break;

                case 'updateembed':
                    const channelId = process.env.PERSISTENT_CHANNEL_ID;
                    const messageId = process.env.PERSISTENT_MESSAGE_ID;
                    
                    if (!channelId || !messageId) {
                        return await interaction.reply({
                            content: '❌ No persistent embed set. Use `/admin setchannel` first.',
                            ephemeral: true
                        });
                    }
                    
                    const embedChannel = await interaction.client.channels.fetch(channelId);
                    const embedMessage = await embedChannel.messages.fetch(messageId);
                    
                    const embedBuilder2 = new WipeEmbedBuilder(db);
                    const newEmbedData = await embedBuilder2.buildEmbed();
                    
                    await embedMessage.edit(newEmbedData);
                    
                    await interaction.reply({
                        content: '✅ Persistent embed updated.',
                        ephemeral: true
                    });
                    break;

                case 'lockplayer':
                    const userToLock = interaction.options.getUser('user');
                    
                    // Check if anyone is already locked
                    const currentLocked = await db.get('SELECT discord_id, username FROM players WHERE locked = 1');
                    if (currentLocked) {
                        return await interaction.reply({
                            content: `❌ ${currentLocked.username} is already locked. Use \`/admin unlockplayer\` first.`,
                            ephemeral: true
                        });
                    }
                    
                    // Check if user is in player pool
                    const playerToLock = await db.get('SELECT * FROM players WHERE discord_id = ? AND active = 1', [userToLock.id]);
                    if (!playerToLock) {
                        return await interaction.reply({
                            content: `❌ ${userToLock.username} is not in the active player pool.`,
                            ephemeral: true
                        });
                    }
                    
                    // Lock the player
                    await db.run('UPDATE players SET locked = 1 WHERE discord_id = ?', [userToLock.id]);
                    
                    await interaction.reply({
                        content: `🔒 ${userToLock.username} is now locked to slot 1 for all future selections.`,
                        ephemeral: true
                    });
                    break;

                case 'unlockplayer':
                    const lockedPlayer = await db.get('SELECT discord_id, username FROM players WHERE locked = 1');
                    if (!lockedPlayer) {
                        return await interaction.reply({
                            content: `❌ No player is currently locked.`,
                            ephemeral: true
                        });
                    }
                    
                    await db.run('UPDATE players SET locked = 0 WHERE locked = 1');
                    
                    await interaction.reply({
                        content: `🔓 ${lockedPlayer.username} is no longer locked.`,
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
    },

    async handleTieBreaking(interaction, selectionResult) {
        const ties = selectionResult.ties[0]; // Handle first tie group
        
        const embed = new EmbedBuilder()
            .setTitle('⚖️ Tie-Breaking Required')
            .setDescription('Multiple players have the same priority score. Please select manually:')
            .setColor(0xF39C12);

        // Add tied players as fields
        ties.forEach((player, index) => {
            embed.addFields({
                name: `Option ${index + 1}: ${player.username}`,
                value: `Score: ${player.totalScore}\nWeeks since last: ${player.breakdown.weeksSinceLastPlayed}\nTotal games: ${player.breakdown.totalGamesPlayed}`,
                inline: true
            });
        });

        // Create buttons for each tied player
        const buttons = ties.map((player, index) => 
            new ButtonBuilder()
                .setCustomId(`tie_select_${player.discord_id}`)
                .setLabel(`Select ${player.username}`)
                .setStyle(ButtonStyle.Primary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        await interaction.reply({
            content: `<@&661441458804621332> <@&661441014535553044>`,
            embeds: [embed],
            components: [row],
            ephemeral: false
        });
    }
};
