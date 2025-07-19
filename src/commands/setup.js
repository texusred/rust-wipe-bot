const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const DatabaseQueries = require('../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup commands for initial bot configuration')
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset all data (DANGEROUS)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('players')
                .setDescription('Add all players to the database'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Setup historical data'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const db = interaction.client.db;
        const queries = new DatabaseQueries(db);

        try {
            switch (subcommand) {
                case 'reset':
                    await interaction.reply({ content: '🗑️ Resetting all data...', ephemeral: true });
                    
                    await new Promise((resolve, reject) => {
                        db.exec(`
                            DELETE FROM interest_expressions;
                            DELETE FROM player_history;
                            DELETE FROM wipe_cycles;
                            DELETE FROM players;
                        `, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    await interaction.editReply({ content: '✅ All data reset successfully.', ephemeral: true });
                    break;

                case 'players':
                    await interaction.reply({ content: '👥 Setting up players...', ephemeral: true });
                    
                    const playerData = [
                        { id: '511300149029371943', name: 'rockst3adii', status: 'active' },
                        { id: '396066502433832961', name: 'dasheepxj', status: 'active' },
                        { id: '649323829902180353', name: 'drukpor', status: 'active' },
                        { id: '822480016264527892', name: 'stonedape1825', status: 'active' },
                        { id: '742033517785120819', name: 'majorhit', status: 'active' },
                        { id: '187950620987097090', name: 'texusbread', status: 'active' },
                        { id: '527196397519241225', name: 'bulc0', status: 'active' },
                        { id: '594748455466041351', name: 'goldensunbro', status: 'frozen' },
                        { id: '305067627611422731', name: 'viablefalcon', status: 'frozen' },
                        { id: '797607500887097415', name: 'oohyaa_brothers3', status: 'frozen' }
                    ];

                    let addedCount = 0;
                    for (const player of playerData) {
                        try {
                            await queries.addPlayer(player.id, player.name);
                            
                            // Set frozen players as inactive
                            if (player.status === 'frozen') {
                                await new Promise((resolve, reject) => {
                                    db.run('UPDATE players SET active = 0 WHERE discord_id = ?', [player.id], (err) => {
                                        if (err) reject(err);
                                        else resolve();
                                    });
                                });
                            }
                            
                            addedCount++;
                            console.log(`✅ Added: ${player.name} (${player.id})`);
                        } catch (error) {
                            if (error.message.includes('already exists')) {
                                console.log(`⏭️ Skipped: ${player.name} (already exists)`);
                            } else {
                                console.error(`❌ Failed to add ${player.name}:`, error);
                            }
                        }
                    }

                    await interaction.editReply({
                        content: `✅ Players setup complete! Added ${addedCount} players.`,
                        ephemeral: true
                    });
                    break;

                case 'history':
                    await interaction.reply({ content: '📊 Setting up historical data...', ephemeral: true });
                    
                    // Create current cycle
                    const cycleId = await queries.createNewCycle('2025-07-16', '2025-07-23', 'active');
                    
                    // Set current selection
                    const currentSelection = {
                        selected: [
                            { discord_id: '511300149029371943', username: 'rockst3adii', status: 'locked' },
                            { discord_id: '822480016264527892', username: 'stonedape1825', status: 'confirmed' },
                            { discord_id: '742033517785120819', username: 'majorhit', status: 'pending' },
                            { discord_id: '187950620987097090', username: 'texusbread', status: 'pending' }
                        ],
                        backup: [
                            { discord_id: '527196397519241225', username: 'bulc0', status: 'backup' },
                            { discord_id: '396066502433832961', username: 'dasheepxj', status: 'backup' },
                            { discord_id: '649323829902180353', name: 'drukpor', status: 'backup' }
                        ]
                    };
                    
                    await queries.updateCycleSelection(cycleId, currentSelection);
                    
                    // Add interest expressions
                    const interestedPlayers = ['396066502433832961', '822480016264527892', '742033517785120819', '187950620987097090', '527196397519241225'];
                    for (const playerId of interestedPlayers) {
                        try {
                            await queries.expressInterest(playerId);
                        } catch (error) {
                            console.log(`Interest already recorded for ${playerId}`);
                        }
                    }
                    
                    // Set rockst3adii as locked
                    await new Promise((resolve, reject) => {
                        db.run('UPDATE players SET locked = 1 WHERE discord_id = ?', ['511300149029371943'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    const embed = new EmbedBuilder()
                        .setTitle('✅ Historical Data Setup Complete')
                        .setDescription('Added corrected participation history and current selection')
                        .addFields(
                            {
                                name: 'This Friday\'s Selected',
                                value: '@RockSt3adii (🔒), @Stoned Ape, @Major Hit, @Texas',
                                inline: false
                            },
                            {
                                name: 'Backup Queue',
                                value: '@bulc0, @DaSheep, @Dr DRE',
                                inline: false
                            },
                            {
                                name: 'Current Interests (for next selection)',
                                value: '@DaSheep, @Stoned Ape, @Major Hit, @Texas, @bulc0',
                                inline: false
                            },
                            {
                                name: 'Tie Scenario',
                                value: '@Texas vs @bulc0 (both played 2 weeks ago)',
                                inline: false
                            }
                        )
                        .setColor(0x57F287);

                    await interaction.editReply({ embeds: [embed], ephemeral: true });
                    break;

                default:
                    await interaction.reply({
                        content: '❌ Unknown setup command.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Setup command error:', error);
            await interaction.reply({
                content: 'Error setting up data!',
                ephemeral: true
            });
        }
    }
};
