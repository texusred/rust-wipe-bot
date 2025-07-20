const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DatabaseQueries = require('../database/queries');
const SelectionAlgorithm = require('../services/selectionAlgorithm');

module.exports = {
    async handleExpressInterest(interaction) {
        const db = interaction.client.db;
        const queries = new DatabaseQueries(db);

        try {
            const players = await queries.getAllPlayers();
            const player = players.find(p => p.discord_id === interaction.user.id);

            if (!player) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Not in Player Pool')
                    .setDescription('You need to be added to the player pool first. Contact an admin.')
                    .setColor(0xE74C3C);

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const hasInterest = await queries.hasExpressedInterest(interaction.user.id);
            if (hasInterest) {
                const embed = new EmbedBuilder()
                    .setTitle('ℹ️ Interest Already Recorded')
                    .setDescription('You have already expressed interest for the next selection cycle.')
                    .setColor(0x3498DB);

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await queries.expressInterest(interaction.user.id);

            const embed = new EmbedBuilder()
                .setTitle('✅ Interest Recorded')
                .setDescription('Your interest has been recorded for **Sunday\'s selection**!')
                .addFields(
                    { name: 'What this means', value: 'You\'ll get +15 priority points for the wipe AFTER next Friday', inline: false },
                    { name: 'Next Selection', value: 'Sunday 7PM EST', inline: true },
                    { name: 'Selection is for', value: 'The Friday wipe AFTER next Friday', inline: true }
                )
                .setColor(0x57F287);

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error expressing interest:', error);

            if (error.message.includes('already expressed')) {
                const embed = new EmbedBuilder()
                    .setTitle('ℹ️ Interest Already Recorded')
                    .setDescription('You have already expressed interest for the next selection cycle.')
                    .setColor(0x3498DB);

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await interaction.reply({
                content: 'Error recording your interest. Please try again.',
                ephemeral: true
            });
        }
    },

    async handleNotInterestedNext(interaction) {
        const db = interaction.client.db;

        try {
            // Check if player exists
            const player = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM players WHERE discord_id = ?', [interaction.user.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!player) {
                return await interaction.reply({
                    content: '❌ You need to be added to the player pool first.',
                    ephemeral: true
                });
            }

            // Check if already set to skip
            if (player.skip_next_wipe) {
                return await interaction.reply({
                    content: 'ℹ️ You are already set to skip the next wipe selection.',
                    ephemeral: true
                });
            }

            // Set skip flag
            await new Promise((resolve, reject) => {
                db.run('UPDATE players SET skip_next_wipe = TRUE WHERE discord_id = ?', [interaction.user.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const embed = new EmbedBuilder()
                .setTitle('⏭️ Skipping Next Wipe')
                .setDescription('You will be excluded from the next Sunday selection only.')
                .addFields(
                    { name: 'What this means', value: 'You won\'t be selected for the next wipe, but will automatically be back in rotation for the wipe after.', inline: false },
                    { name: 'Auto-reset', value: 'This flag will clear automatically after the next selection.', inline: false }
                )
                .setColor(0xF39C12);

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error setting skip next wipe:', error);
            await interaction.reply({
                content: 'Error updating your status. Please try again.',
                ephemeral: true
            });
        }
    },

    async handleViewStats(interaction) {
        const db = interaction.client.db;
        const queries = new DatabaseQueries(db);
        const algorithm = new SelectionAlgorithm(db);

        try {
            const players = await queries.getAllPlayers();
            const player = players.find(p => p.discord_id === interaction.user.id);

            if (!player) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Not in Player Pool')
                    .setDescription('You need to be added to the player pool first.')
                    .setColor(0xE74C3C);

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const history = await queries.getPlayerHistory(interaction.user.id);
            const hasInterest = await queries.hasExpressedInterest(interaction.user.id);

            const totalGames = player.total_games_played;
            const scoreData = await queries.calculatePriorityScore(interaction.user.id);
            const realScore = scoreData.totalScore;

            const lastPlayedText = scoreData.breakdown.weeksAgo === 99 ? 'Never' :
                                  scoreData.breakdown.weeksAgo === 0 ? 'This week' :
                                  scoreData.breakdown.weeksAgo === 1 ? '1 week ago' :
                                  `${scoreData.breakdown.weeksAgo} weeks ago`;

            const statusText = player.locked ? '🔒 Locked to slot 1' :
                              player.skip_next_wipe ? '⏭️ Skipping next wipe' :
                              'Available';

            const embed = new EmbedBuilder()
                .setTitle('📊 Your Wipe Statistics')
                .setDescription(`Statistics for ${interaction.user.username}`)
                .addFields(
                    { name: 'Total Games Played', value: totalGames.toString(), inline: true },
                    { name: 'Last Played', value: lastPlayedText, inline: true },
                    { name: 'Interest Expressed', value: hasInterest ? 'Yes' : 'No', inline: true },
                    { name: 'Recent Games (6 weeks)', value: totalGames.toString(), inline: true },
                    { name: 'Status', value: statusText, inline: true }
                )
                .setColor(0x3498DB)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error viewing stats:', error);
            await interaction.reply({
                content: 'Error retrieving your statistics. Please try again.',
                ephemeral: true
            });
        }
    },

    async handleConfirmParticipation(interaction) {
        const db = interaction.client.db;
        const queries = new DatabaseQueries(db);

        try {
            // Get current cycle and check if user is selected
            const currentCycle = await queries.getCurrentCycle();
            if (!currentCycle || !currentCycle.selected_players) {
                return await interaction.reply({
                    content: '❌ No active selection found.',
                    ephemeral: true
                });
            }

            const selectionData = typeof currentCycle.selected_players === "string" ? JSON.parse(currentCycle.selected_players) : currentCycle.selected_players;
            const selectedPlayer = selectionData.selected.find(p => p.discord_id === interaction.user.id);

            if (!selectedPlayer) {
                return await interaction.reply({
                    content: '❌ You are not selected for this week\'s wipe.',
                    ephemeral: true
                });
            }

            if (selectedPlayer.status === 'confirmed') {
                return await interaction.reply({
                    content: 'ℹ️ You have already confirmed your participation.',
                    ephemeral: true
                });
            }

            if (selectedPlayer.status === 'locked') {
                return await interaction.reply({
                    content: 'ℹ️ Your slot is locked - no confirmation needed.',
                    ephemeral: true
                });
            }

            // Update status to confirmed
            selectedPlayer.status = 'confirmed';

            // Save back to database
            await queries.updateCycleSelection(currentCycle.cycle_id, selectionData);

            const embed = new EmbedBuilder()
                .setTitle('✅ Participation Confirmed')
                .setDescription('You have confirmed your participation for this Friday\'s wipe!')
                .setColor(0x57F287);

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error confirming participation:', error);
            await interaction.reply({
                content: 'Error confirming participation. Please try again.',
                ephemeral: true
            });
        }
    },

    async handlePassTurn(interaction) {
        const db = interaction.client.db;
        const queries = new DatabaseQueries(db);

        try {
            // Get current cycle
            const currentCycle = await queries.getCurrentCycle();
            if (!currentCycle || !currentCycle.selected_players) {
                return await interaction.reply({
                    content: '❌ No active selection found.',
                    ephemeral: true
                });
            }

            const selectionData = typeof currentCycle.selected_players === "string" ? JSON.parse(currentCycle.selected_players) : currentCycle.selected_players;
            
            // Find the user in selected players
            const selectedIndex = selectionData.selected.findIndex(p => p.discord_id === interaction.user.id);
            if (selectedIndex === -1) {
                return await interaction.reply({
                    content: '❌ You are not in the selected players list.',
                    ephemeral: true
                });
            }

            // Check if there are backup players available
            if (!selectionData.backup || selectionData.backup.length === 0) {
                return await interaction.reply({
                    content: '❌ No backup players available to promote.',
                    ephemeral: true
                });
            }

            // Get the first backup player
            const promotedPlayer = selectionData.backup.shift();
            promotedPlayer.status = 'pending';

            // Remove the passing player from selected
            const passingPlayer = selectionData.selected[selectedIndex];
            selectionData.selected.splice(selectedIndex, 1);

            // Add the promoted player to selected at the end
            selectionData.selected.push(promotedPlayer);

            // Save back to database
            await queries.updateCycleSelection(currentCycle.cycle_id, selectionData);

            const embed = new EmbedBuilder()
                .setTitle('❌ Turn Passed')
                .setDescription(`You have passed your turn. <@${promotedPlayer.discord_id}> has been promoted from backup queue!`)
                .setColor(0xE74C3C);

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error passing turn:', error);
            await interaction.reply({
                content: 'Error passing your turn. Please try again.',
                ephemeral: true
            });
        }
    },

    async handleViewSchedule(interaction) {
        const today = new Date();

        // Calculate next 4 Friday wipes (7PM UK time)
        const nextWipes = [];
        for (let i = 0; i < 4; i++) {
            const friday = new Date(today);
            let daysUntilFriday = (5 - today.getDay() + 7) % 7;
            if (daysUntilFriday === 0 && today.getHours() >= 19) daysUntilFriday = 7; // If it's Friday after 7PM, next Friday
            friday.setDate(today.getDate() + daysUntilFriday + (i * 7));
            friday.setHours(18, 0, 0, 0); // 7PM UK = 6PM UTC (BST)
            nextWipes.push(friday);
        }

        // Calculate next 4 Sunday selections (7PM EST)
        const nextSelections = [];
        for (let i = 0; i < 4; i++) {
            const sunday = new Date(today);
            let daysUntilSunday = (7 - today.getDay()) % 7;
            if (daysUntilSunday === 0) daysUntilSunday = 7; // If it's Sunday, next Sunday
            sunday.setDate(today.getDate() + daysUntilSunday + (i * 7));
            sunday.setHours(23, 0, 0, 0); // 7PM EST = 11PM UTC
            nextSelections.push(sunday);
        }

        const wipeText = nextWipes.map((date, i) => {
            const timestamp = Math.floor(date.getTime() / 1000);
            return `**Week ${i + 1}:** <t:${timestamp}:F>`;
        }).join('\n');

        const selectionText = nextSelections.map((date, i) => {
            const timestamp = Math.floor(date.getTime() / 1000);
            return `**Week ${i + 1}:** <t:${timestamp}:F>`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📅 Wipe & Selection Schedule')
            .addFields(
                {
                    name: '🎮 Upcoming Wipes (Fridays 7PM UK)',
                    value: wipeText,
                    inline: false
                },
                {
                    name: '🎯 Selection Times (Sundays 7PM EST)',
                    value: selectionText,
                    inline: false
                },
                {
                    name: '💡 How it works',
                    value: '• Express interest anytime for the **next Sunday selection**\n• Sunday selections are for the **following Friday wipe**\n• Interest resets after each selection',
                    inline: false
                }
            )
            .setColor(0x9B59B6);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
