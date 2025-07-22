const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DatabaseQueries = require('../database/queries');

class WipeEmbedBuilder {
    static async buildPersistentEmbed(client, db) {
        // Get current state
        const stateManager = client.stateManager;
        const currentState = await stateManager.getCurrentState();
        
        // Build embed based on current state
        switch (currentState) {
            case stateManager.STATES.WIPE_IN_PROGRESS:
                return await this.buildWipeInProgressEmbed(client, db, stateManager);
            case stateManager.STATES.PRE_SELECTION:
                return await this.buildPreSelectionEmbed(client, db, stateManager);
            case stateManager.STATES.SELECTION_RESULTS:
                return await this.buildSelectionResultsEmbed(client, db, stateManager);
            default:
                return await this.buildSelectionResultsEmbed(client, db, stateManager);
        }
    }

    // Helper function to get specific event times - FIXED TIMEZONE
    static getEventTimes() {
        const now = new Date();
        
        // Calculate next Monday 5AM EST (10AM UTC)
        const nextMonday5AMEST = new Date(now);
        let daysUntilMonday = (1 - now.getUTCDay() + 7) % 7;
        if (daysUntilMonday === 0 && now.getUTCHours() >= 10) {
            daysUntilMonday = 7;
        }
        nextMonday5AMEST.setUTCDate(now.getUTCDate() + daysUntilMonday);
        nextMonday5AMEST.setUTCHours(10, 0, 0, 0);
        
        // Calculate next Friday 7PM EST (12AM UTC Saturday)
        const nextFriday7PMEST = new Date(now);
        let daysUntilFriday = (5 - now.getUTCDay() + 7) % 7;
        if (daysUntilFriday === 0 && now.getUTCHours() >= 0) {
            daysUntilFriday = 7;
        }
        nextFriday7PMEST.setUTCDate(now.getUTCDate() + daysUntilFriday);
        nextFriday7PMEST.setUTCHours(0, 0, 0, 0);
        
        // Calculate next Saturday 12PM EST (5PM UTC)
        const nextSaturday12PMEST = new Date(now);
        nextSaturday12PMEST.setUTCHours(17, 0, 0, 0);
        return {
            mondayResults: nextMonday5AMEST,
            fridayWipe: nextFriday7PMEST,
            saturdaySelection: nextSaturday12PMEST
        };
    }

    // State 1: Wipe in Progress (Friday 7PM → Saturday 12PM EST)
    static async buildWipeInProgressEmbed(client, db, stateManager) {
        const queries = new DatabaseQueries(db);
        const currentCycle = await queries.getCurrentCycle();
        const times = WipeEmbedBuilder.getEventTimes();
        
        let currentTeam = [];
        if (currentCycle && currentCycle.selected_players) {
            const selectionData = typeof currentCycle.selected_players === "string" ? 
                JSON.parse(currentCycle.selected_players) : currentCycle.selected_players;
            currentTeam = selectionData.selected || [];
        }

        const teamText = this.buildPlayerList(currentTeam, false) || 'No team data';

        const embed = new EmbedBuilder()
            .setTitle('🔥 WIPE IN PROGRESS')
            .setDescription('**Server:** WarBandits US 2X Quad')
            .addFields(
                {
                    name: '🎮 Current Team Playing',
                    value: teamText,
                    inline: false
                },
                {
                    name: '🎯 Pre-Selection Starts',
                    value: `<t:${Math.floor(times.saturdaySelection.getTime() / 1000)}:R>`,
                    inline: true
                },
                {
                    name: '📅 Status',
                    value: 'Wipe is currently active',
                    inline: true
                },
                {
                    name: '💡 Express Interest',
                    value: 'Express interest for **next week\'s** wipe while the current wipe is active!',
                    inline: false
                }
            )
            .setColor(0xE74C3C) // Red color for active wipe
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("express_interest")
                    .setLabel("Express Interest (Next Week)")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("not_interested_next")
                    .setLabel("Skip Next Wipe")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("view_schedule")
                    .setLabel("View Schedule")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("view_stats")
                    .setLabel("View My Stats")
                    .setStyle(ButtonStyle.Secondary)
            );

        console.log("🎯 Calculated times:");
        console.log("📅 Next Friday Wipe:", times.fridayWipe.toISOString());
        console.log("📅 Next Monday Selection:", nextMonday5AMEST.toISOString());
        console.log("📅 Next Saturday Pre-Selection:", times.saturdaySelection.toISOString());
        return { embeds: [embed], components: [row] };
    }

    // State 2: Pre-Selection (Saturday 12PM → Monday 5AM EST)
    static async buildPreSelectionEmbed(client, db, stateManager) {
        const times = WipeEmbedBuilder.getEventTimes();

        const embed = new EmbedBuilder()
            .setTitle('🎯 SELECTION IN PROGRESS')
            .setDescription('**Server:** WarBandits US 2X Quad')
            .addFields(
                {
                    name: '⚙️ Algorithm Status',
                    value: '🔄 Running selection algorithm...\n⏳ Admin approval pending',
                    inline: false
                },
                {
                    name: '📢 Results Announcement',
                    value: `<t:${Math.floor(nextMonday5AMEST.getTime() / 1000)}:F>`,
                    inline: true
                },
                {
                    name: '⏰ Time Until Results',
                    value: `<t:${Math.floor(nextMonday5AMEST.getTime() / 1000)}:R>`,
                    inline: true
                },
                {
                    name: '💡 Express Interest',
                    value: 'You can still express interest for **next week\'s** selection!',
                    inline: false
                }
            )
            .setColor(0xF39C12) // Orange color for processing
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("express_interest")
                    .setLabel("Express Interest (Next Week)")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("not_interested_next")
                    .setLabel("Skip Next Wipe")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("view_stats")
                    .setLabel("View My Stats")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("view_schedule")
                    .setLabel("View Schedule")
                    .setStyle(ButtonStyle.Secondary)
            );

        console.log("🎯 Calculated times:");
        console.log("📅 Next Friday Wipe:", times.fridayWipe.toISOString());
        console.log("📅 Next Monday Selection:", nextMonday5AMEST.toISOString());
        console.log("📅 Next Saturday Pre-Selection:", times.saturdaySelection.toISOString());
        return { embeds: [embed], components: [row] };
    }

    // State 3: Selection Results (Monday 5AM → Friday 7PM EST) - Current functionality
    static async buildSelectionResultsEmbed(client, db, stateManager) {
        const times = WipeEmbedBuilder.getEventTimes();

        // Next Sunday 7PM EST (for next selection) - keeping original logic for this
        const now = new Date();
        console.log("🕐 DEBUG: Current time checks:");
        console.log("📅 Now (UTC):", now.toISOString());
        console.log("📅 Now (EST):", now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        console.log("📅 Now (UK):", now.toLocaleString("en-GB", {timeZone: "Europe/London"}));
        const nextSunday = new Date();
        let daysUntilSunday = (7 - now.getDay()) % 7;
        if (daysUntilSunday === 0) daysUntilSunday = 7;
        nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
        nextSunday.setUTCHours(23, 0, 0, 0); // 7PM EST = 11PM UTC

        // Wednesday midnight EST (confirmation deadline)
        // Wednesday midnight EST (confirmation deadline) - 5 days after Friday wipe
        // Wednesday midnight EST (confirmation deadline) - 2 days BEFORE Friday wipe
        const confirmDeadline = new Date(times.fridayWipe);
        confirmDeadline.setUTCDate(times.fridayWipe.getUTCDate() - 2);
        confirmDeadline.setUTCHours(5, 0, 0, 0); // Wednesday midnight EST = 5AM UTC
        console.log("⏰ Confirm deadline calculation:");
        console.log("📅 Friday wipe:", times.fridayWipe.toISOString());
        console.log("📅 Confirm deadline (final):", confirmDeadline.toISOString());
        console.log("🕐 Days until deadline:", Math.ceil((confirmDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

        // Get current cycle data
        const queries = new DatabaseQueries(db);
        const currentCycle = await queries.getCurrentCycle();
        let selectedPlayers = [];
        let backupQueue = [];

        if (currentCycle && currentCycle.selected_players) {
            const selectionData = typeof currentCycle.selected_players === "string" ? 
                JSON.parse(currentCycle.selected_players) : currentCycle.selected_players;
            selectedPlayers = selectionData.selected || [];
            backupQueue = selectionData.backup || [];
        }

        const selectedText = this.buildPlayerList(selectedPlayers, true);
        const backupText = this.buildPlayerList(backupQueue, false);
        const confirmedCount = selectedPlayers.filter(p => p.status === 'confirmed').length;

        const embed = new EmbedBuilder()
            .setTitle('🦀 RUST WIPE MANAGEMENT')
            .setDescription('**Server:** WarBandits US 2X Quad')
            .addFields(
                {
                    name: '🎮 THIS FRIDAY\'S WIPE',
                    value: `<t:${Math.floor(times.fridayWipe.getTime() / 1000)}:F>`,
                    inline: true
                },
                {
                    name: '🎯 NEXT SELECTION',
                    value: `<t:${Math.floor(nextSunday.getTime() / 1000)}:F>`,
                    inline: true
                },
                {
                    name: '⏰ CONFIRM BY',
                    value: `<t:${Math.floor(confirmDeadline.getTime() / 1000)}:R>`,
                    inline: true
                },
                {
                    name: 'SELECTED PLAYERS (This Friday)',
                    value: selectedText || 'No players selected yet',
                    inline: false
                },
                {
                    name: 'BACKUP QUEUE',
                    value: backupText || 'No backup players',
                    inline: false
                },
                {
                    name: `Status: ${confirmedCount}/4 Confirmed`,
                    value: `Deadline: <t:${Math.floor(confirmDeadline.getTime() / 1000)}:R>`,
                    inline: false
                },
                {
                    name: '💡 Express Interest',
                    value: 'Express interest for the wipe AFTER next Friday (affects Sunday\'s selection)',
                    inline: false
                }
            )
            .setColor(0x57F287) // Green color for confirmed results
            .setTimestamp();

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('express_interest')
                    .setLabel('Express Interest')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('not_interested_next')
                    .setLabel('Skip Next Wipe')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('view_stats')
                    .setLabel('View My Stats')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_participation')
                    .setLabel('✅ Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('pass_turn')
                    .setLabel('❌ Pass')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('view_schedule')
                    .setLabel('View Schedule')
                    .setStyle(ButtonStyle.Secondary)
            );

        console.log("🎯 Calculated times:");
        console.log("📅 Next Friday Wipe:", times.fridayWipe.toISOString());
        console.log("📅 Next Monday Selection:", times.mondayResults.toISOString());
        console.log("📅 Next Saturday Pre-Selection:", times.saturdaySelection.toISOString());
        return { embeds: [embed], components: [row1, row2] };
    }

    static buildPlayerList(players, includeStatus = false) {
        if (!players || players.length === 0) return 'None';

        const lines = [];
        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            let line = `${i + 1}. `;

            if (includeStatus) {
                const emoji = player.status === 'locked' ? '🔒' :
                             player.status === 'confirmed' ? '✅' :
                             '⏳';
                line += `${emoji} <@${player.discord_id}>`;
            } else {
                line += `💥 <@${player.discord_id}>`;
            }

            lines.push(line);
        }

        return lines.join('\n');
    }
}

module.exports = WipeEmbedBuilder;
